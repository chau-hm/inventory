import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { JsonFileDocumentRepository } from "../adapters/documents/json-file-document-repository.js";
import { LocalAttachmentStorage } from "../adapters/documents/local-attachment-storage.js";
import { JsonFileItemRepository } from "../adapters/json-file-item-repository.js";
import { JsonFileServiceEventRepository } from "../adapters/json-file-service-event-repository.js";
import { openInventoryDatabase } from "../adapters/sqlite/database.js";
import { SqliteItemRepository } from "../adapters/sqlite/item-repository.js";
import { createDocumentIngestDraft, DocumentService, NoopOcrProvider } from "../application/documents.js";
import { exportEvidencePack, formatEvidencePackForTelegram } from "../application/exporters/evidence-pack.js";
import { ItemService, type ItemPatch, type TargetResolutionError } from "../application/items.js";
import { calculateDueReminders } from "../application/reminders.js";
import { ServiceEventService } from "../application/service-events.js";
import {
  parseChatItem,
  parseChatItemIntent,
  parseChatItemMutationIntent,
  type ChatItemIntent,
  type ChatItemDraft,
  type ChatItemParseResult
} from "../domain/chat-intake.js";
import { validateItemDraft } from "../domain/item.js";
import { calculateWarrantyState } from "../domain/warranty.js";

export const cliVersion = "0.1.0";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("inventory")
    .description("Agent-native personal inventory control CLI")
    .version(cliVersion);

  program
    .command("health")
    .description("Check that the inventory CLI is available")
    .option("--format <format>", "Output format: text or json", "text")
    .action((options: { format: string }) => {
      if (options.format === "json") {
        console.log(JSON.stringify({ ok: true, app: "inventory-control", version: cliVersion }));
        return;
      }

      console.log(`inventory-control ${cliVersion} ok`);
    });

  const chat = program.command("chat").description("Natural-language chat intake commands");

  chat
    .command("parse")
    .description("Parse natural-language item text into a non-mutating add draft")
    .argument("<text...>", "Natural-language item text")
    .option("--format <format>", "Output format: text or json", "text")
    .action((textParts: string[], options: { format: string }) => {
      const result = parseChatItem(textParts.join(" "));
      if (options.format === "json") {
        console.log(JSON.stringify(result));
        return;
      }
      console.log(formatChatParseText(result));
    });

  chat
    .command("items")
    .description("Parse natural-language list/search text and return matching saved items")
    .argument("<text...>", "Natural-language list/search text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--status <status>", "Status filter override: active, deleted, or all")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (textParts: string[], options: ItemStoreOptions & { status?: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const intent = parseChatItemIntent(textParts.join(" "));
        const status = (options.status ?? intent.status) as never;
        const service = createItemService(options);
        const items = intent.kind === "item_list"
          ? await service.list({ status })
          : await service.search(intent.query, { status });
        const result = { ...intent, status, items };
        if (options.format === "json") {
          return result;
        }
        return formatChatItemsText(intent, items);
      });
    });

  chat
    .command("mutate")
    .description("Parse natural-language edit/delete/restore text and mutate only one unambiguous item")
    .argument("<text...>", "Natural-language mutation text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (textParts: string[], options: ItemStoreOptions & { format: string }) => {
      await runItemAction(options.format, async () => {
        const intent = parseChatItemMutationIntent(textParts.join(" "));
        if (intent.kind === "needs_clarification") {
          if (options.format === "json") {
            return intent;
          }
          return `Need clarification: ${intent.missing.join(", ")}`;
        }

        const service = createItemService(options);
        const item = await applyChatMutation(service, intent);
        const result = { kind: "updated_item" as const, action: intent.action, item };
        if (options.format === "json") {
          return result;
        }
        return `Item ${intent.action}: ${item.id} ${item.name}`;
      });
    });

  chat
    .command("confirm")
    .description("Confirm a parsed item draft JSON and save it")
    .requiredOption("--draft-json <json>", "Draft JSON from chat parse")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ItemStoreOptions & { draftJson: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const draft = parseChatDraftJson(options.draftJson);
        const saved = await createItemService(options).add(chatDraftToItemInput(draft));
        const result = { kind: "confirmed_item" as const, item: saved };
        if (options.format === "json") {
          return result;
        }
        return `Item confirmed: ${saved.id} ${saved.name} (${saved.category}, ${saved.status})`;
      });
    });

  const item = program.command("item").description("Item-related commands");

  item
    .command("add")
    .description("Add an item to the JSON item store")
    .requiredOption("--name <name>", "Item name")
    .requiredOption("--category <category>", "Item category")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--brand <brand>", "Brand")
    .option("--model <model>", "Model")
    .option("--serial <serialNumber>", "Serial number")
    .option("--location <location>", "Item location")
    .option("--owner <owner>", "Owner")
    .option("--purchase-date <date>", "Purchase date in YYYY-MM-DD format")
    .option("--purchase-price-minor <amount>", "Purchase price in minor units")
    .option("--currency <currency>", "Three-letter uppercase currency code")
    .option("--merchant <merchant>", "Merchant or supplier")
    .option("--warranty-start <date>", "Warranty start date in YYYY-MM-DD format")
    .option("--warranty-end <date>", "Warranty end date in YYYY-MM-DD format")
    .option("--warranty-months <months>", "Warranty duration in whole months")
    .option("--notes <notes>", "Notes")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ItemCommandOptions) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const saved = await service.add(itemInputFromOptions(options));
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `Item added: ${saved.id} ${saved.name} (${saved.category}, ${saved.status})`;
      });
    });

  item
    .command("list")
    .description("List items from the item store")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--status <status>", "Status filter, or all", "active")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ItemStoreOptions & { status: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const items = await service.list({ status: options.status as never });
        if (options.format === "json") {
          return { ok: true, items };
        }
        return items.length === 0
          ? "No items found."
          : items.map((saved) => `${saved.id} ${saved.name} (${saved.category}, ${saved.status})`).join("\n");
      });
    });

  item
    .command("detail")
    .description("Show one item by exact ID or unambiguous text target")
    .argument("<target>", "Item ID or search text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: ItemStoreOptions & { format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const saved = await service.detail(target);
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `${saved.id} ${saved.name} (${saved.category}, ${saved.status})`;
      });
    });

  item
    .command("edit")
    .description("Edit one item by exact ID or unambiguous text target")
    .argument("<target>", "Item ID or search text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--name <name>", "Item name")
    .option("--category <category>", "Item category")
    .option("--status <status>", "Item lifecycle status")
    .option("--brand <brand>", "Brand")
    .option("--model <model>", "Model")
    .option("--serial <serialNumber>", "Serial number")
    .option("--location <location>", "Item location")
    .option("--owner <owner>", "Owner")
    .option("--purchase-date <date>", "Purchase date in YYYY-MM-DD format")
    .option("--purchase-price-minor <amount>", "Purchase price in minor units")
    .option("--currency <currency>", "Three-letter uppercase currency code")
    .option("--merchant <merchant>", "Merchant or supplier")
    .option("--warranty-start <date>", "Warranty start date in YYYY-MM-DD format")
    .option("--warranty-end <date>", "Warranty end date in YYYY-MM-DD format")
    .option("--warranty-months <months>", "Warranty duration in whole months")
    .option("--notes <notes>", "Notes")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: ItemCommandOptions) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const saved = await service.edit(target, itemPatchFromOptions(options));
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `Item updated: ${saved.id} ${saved.name} (${saved.category}, ${saved.status})`;
      });
    });

  item
    .command("delete")
    .description("Soft delete one item by exact ID or unambiguous text target")
    .argument("<target>", "Item ID or search text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: ItemStoreOptions & { format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const saved = await service.delete(target);
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `Item deleted: ${saved.id} ${saved.name}`;
      });
    });

  item
    .command("restore")
    .description("Restore one deleted item by exact ID or unambiguous text target")
    .argument("<target>", "Item ID or search text")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: ItemStoreOptions & { format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options);
        const saved = await service.restore(target);
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `Item restored: ${saved.id} ${saved.name}`;
      });
    });

  item
    .command("validate")
    .description("Validate an item draft without saving it")
    .requiredOption("--name <name>", "Item name")
    .requiredOption("--category <category>", "Item category")
    .option("--status <status>", "Item lifecycle status")
    .option("--brand <brand>", "Brand")
    .option("--model <model>", "Model")
    .option("--serial <serialNumber>", "Serial number")
    .option("--location <location>", "Item location")
    .option("--owner <owner>", "Owner")
    .option("--purchase-date <date>", "Purchase date in YYYY-MM-DD format")
    .option("--purchase-price-minor <amount>", "Purchase price in minor units")
    .option("--currency <currency>", "Three-letter uppercase currency code")
    .option("--merchant <merchant>", "Merchant or supplier")
    .option("--warranty-start <date>", "Warranty start date in YYYY-MM-DD format")
    .option("--warranty-end <date>", "Warranty end date in YYYY-MM-DD format")
    .option("--warranty-months <months>", "Warranty duration in whole months")
    .option("--notes <notes>", "Notes")
    .option("--deleted-at <timestamp>", "Deletion timestamp as ISO datetime")
    .option("--format <format>", "Output format: text or json", "text")
    .action(
      (options: {
        name: string;
        category: string;
        status?: string;
        brand?: string;
        model?: string;
        serial?: string;
        location?: string;
        owner?: string;
        purchaseDate?: string;
        purchasePriceMinor?: string;
        currency?: string;
        merchant?: string;
        warrantyStart?: string;
        warrantyEnd?: string;
        warrantyMonths?: string;
        notes?: string;
        deletedAt?: string;
        format: string;
      }) => {
        const draft = validateItemDraft({
          name: options.name,
          category: options.category,
          status: options.status,
          brand: options.brand,
          model: options.model,
          serialNumber: options.serial,
          location: options.location,
          owner: options.owner,
          purchaseDate: options.purchaseDate,
          purchasePriceMinor:
            options.purchasePriceMinor === undefined ? undefined : Number(options.purchasePriceMinor),
          currency: options.currency,
          merchant: options.merchant,
          warrantyStart: options.warrantyStart,
          warrantyEnd: options.warrantyEnd,
          warrantyMonths: options.warrantyMonths === undefined ? undefined : Number(options.warrantyMonths),
          notes: options.notes,
          deletedAt: options.deletedAt
        });

        if (options.format === "json") {
          console.log(JSON.stringify({ ok: true, item: draft }));
          return;
        }

        console.log(`Item draft valid: ${draft.name} (${draft.category}, ${draft.status})`);
      }
    );

  const document = program.command("document").description("Document and attachment commands");

  document
    .command("attach")
    .description("Attach a local file to an item")
    .requiredOption("--item <itemId>", "Item ID")
    .requiredOption("--path <path>", "Source file path")
    .requiredOption("--kind <kind>", "Document kind")
    .option("--title <title>", "Document title")
    .option("--notes <notes>", "Document notes")
    .option("--documents-store <path>", "Document metadata store path", defaultDocumentStorePath())
    .option("--attachments-dir <path>", "Attachment storage directory", defaultAttachmentsDir())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: DocumentCommandOptions) => {
      await runDocumentAction(options.format, async () => {
        const service = createDocumentService(options);
        const saved = await service.attach(documentInputFromOptions(options));
        if (options.format === "json") {
          return { ok: true, document: saved };
        }
        return `Document attached: ${saved.id} ${saved.kind} -> ${saved.itemId}`;
      });
    });

  document
    .command("list")
    .description("List attached documents")
    .option("--item <itemId>", "Filter by item ID")
    .option("--status <status>", "Status filter, or all", "active")
    .option("--documents-store <path>", "Document metadata store path", defaultDocumentStorePath())
    .option("--attachments-dir <path>", "Attachment storage directory", defaultAttachmentsDir())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: DocumentStoreOptions & { item?: string; status: string; format: string }) => {
      await runDocumentAction(options.format, async () => {
        const service = createDocumentService(options);
        const documents = await service.list({ itemId: options.item, status: options.status as never });
        if (options.format === "json") {
          return { ok: true, documents };
        }
        return documents.length === 0
          ? "No documents found."
          : documents.map((saved) => `${saved.id} ${saved.kind} ${saved.itemId} (${saved.status})`).join("\n");
      });
    });

  document
    .command("delete")
    .description("Soft delete an attached document")
    .argument("<documentId>", "Document ID")
    .option("--documents-store <path>", "Document metadata store path", defaultDocumentStorePath())
    .option("--attachments-dir <path>", "Attachment storage directory", defaultAttachmentsDir())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (documentId: string, options: DocumentStoreOptions & { format: string }) => {
      await runDocumentAction(options.format, async () => {
        const service = createDocumentService(options);
        const deleted = await service.delete(documentId);
        if (options.format === "json") {
          return { ok: true, document: deleted };
        }
        return `Document deleted: ${deleted.id}`;
      });
    });

  document
    .command("ingest-draft")
    .description("Attach a local file and create an OCR ingest draft")
    .requiredOption("--item <itemId>", "Item ID")
    .requiredOption("--path <path>", "Source file path")
    .requiredOption("--kind <kind>", "Document kind")
    .option("--title <title>", "Document title")
    .option("--notes <notes>", "Document notes")
    .option("--documents-store <path>", "Document metadata store path", defaultDocumentStorePath())
    .option("--attachments-dir <path>", "Attachment storage directory", defaultAttachmentsDir())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: DocumentCommandOptions) => {
      await runDocumentAction(options.format, async () => {
        const service = createDocumentService(options);
        const saved = await service.attach(documentInputFromOptions(options));
        const draft = await createDocumentIngestDraft({ document: saved, provider: new NoopOcrProvider() });
        if (options.format === "json") {
          return { ok: true, document: saved, draft };
        }
        return `Document draft created: ${saved.id} ${saved.kind} (${draft.warnings.join("; ")})`;
      });
    });

  const serviceEvent = program.command("service-event").description("Service timeline commands");

  serviceEvent
    .command("add")
    .description("Add a service event")
    .requiredOption("--item <itemId>", "Item ID")
    .requiredOption("--kind <kind>", "Service event kind")
    .requiredOption("--title <title>", "Service event title")
    .option("--occurred-on <date>", "Occurred date in YYYY-MM-DD format")
    .option("--due-on <date>", "Due date in YYYY-MM-DD format")
    .option("--notes <notes>", "Notes")
    .option("--events-store <path>", "Service event metadata store path", defaultServiceEventStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ServiceEventCommandOptions) => {
      await runSimpleAction(options.format, "SERVICE_EVENT_COMMAND_FAILED", async () => {
        const event = await createServiceEventService(options).add(serviceEventInputFromOptions(options));
        if (options.format === "json") {
          return { ok: true, event };
        }
        return `Service event added: ${event.id} ${event.title} (${event.kind})`;
      });
    });

  serviceEvent
    .command("list")
    .description("List service events")
    .option("--item <itemId>", "Filter by item ID")
    .option("--status <status>", "Status filter, or all", "active")
    .option("--events-store <path>", "Service event metadata store path", defaultServiceEventStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ServiceEventStoreOptions & { item?: string; status: string; format: string }) => {
      await runSimpleAction(options.format, "SERVICE_EVENT_COMMAND_FAILED", async () => {
        const events = await createServiceEventService(options).list({ itemId: options.item, status: options.status as never });
        if (options.format === "json") {
          return { ok: true, events };
        }
        return events.length === 0
          ? "No service events found."
          : events.map((event) => `${event.id} ${event.kind} ${event.itemId} ${event.title} (${event.status})`).join("\n");
      });
    });

  serviceEvent
    .command("delete")
    .description("Soft delete a service event")
    .argument("<eventId>", "Service event ID")
    .option("--events-store <path>", "Service event metadata store path", defaultServiceEventStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (eventId: string, options: ServiceEventStoreOptions & { format: string }) => {
      await runSimpleAction(options.format, "SERVICE_EVENT_COMMAND_FAILED", async () => {
        const event = await createServiceEventService(options).delete(eventId);
        if (options.format === "json") {
          return { ok: true, event };
        }
        return `Service event deleted: ${event.id}`;
      });
    });

  const reminder = program.command("reminder").description("Reminder commands");

  reminder
    .command("due")
    .description("List due warranty and service-event reminders")
    .option("--within <duration>", "Due window such as 45d", "45d")
    .option("--as-of <date>", "Reference date in YYYY-MM-DD format", currentIsoDate())
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--events-store <path>", "Service event metadata store path", defaultServiceEventStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: ReminderCommandOptions) => {
      await runSimpleAction(options.format, "REMINDER_COMMAND_FAILED", async () => {
        const items = await createItemService(options).list({ status: "all" });
        const serviceEvents = await createServiceEventService(options).list({ status: "all" });
        const reminders = calculateDueReminders({
          items,
          serviceEvents,
          asOf: options.asOf,
          withinDays: parseDurationDays(options.within)
        });
        if (options.format === "json") {
          return { ok: true, reminders };
        }
        return reminders.length === 0
          ? "No due reminders."
          : reminders.map((due) => `${due.dedupeKey} ${due.dueOn} ${due.title} (${due.daysUntilDue}d)`).join("\n");
      });
    });

  const exportCommand = program.command("export").description("Export commands");

  exportCommand
    .command("evidence-pack")
    .description("Export an evidence folder for one item")
    .requiredOption("--item <target>", "Item ID or unambiguous search text")
    .requiredOption("--output <dir>", "Output directory")
    .option("--as-of <date>", "Reference date in YYYY-MM-DD format", currentIsoDate())
    .option("--within <duration>", "Reminder due window such as 45d", "45d")
    .option("--db <path>", "SQLite inventory database path")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--documents-store <path>", "Document metadata store path", defaultDocumentStorePath())
    .option("--attachments-dir <path>", "Attachment storage directory", defaultAttachmentsDir())
    .option("--events-store <path>", "Service event metadata store path", defaultServiceEventStorePath())
    .option("--format <format>", "Output format: text, json, or telegram", "text")
    .action(async (options: EvidencePackCommandOptions) => {
      await runSimpleAction(options.format, "EXPORT_COMMAND_FAILED", async () => {
        const item = await createItemService(options).detail(options.item);
        const documents = await createDocumentService(options).list({ itemId: item.id, status: "all" });
        const serviceEvents = await createServiceEventService(options).list({ itemId: item.id, status: "all" });
        const result = await exportEvidencePack({
          item,
          documents,
          serviceEvents,
          asOf: options.asOf,
          reminderWithinDays: parseDurationDays(options.within),
          outputDir: options.output
        });
        if (options.format === "json") {
          return { ok: true, result };
        }
        if (options.format === "telegram") {
          return formatEvidencePackForTelegram(result);
        }
        return `Evidence pack exported: ${result.manifestPath}`;
      });
    });

  const warranty = program.command("warranty").description("Warranty-related commands");

  warranty
    .command("check")
    .description("Calculate warranty state from supplied warranty facts")
    .option("--purchase-date <date>", "Purchase date in YYYY-MM-DD format")
    .option("--warranty-end <date>", "Warranty end date in YYYY-MM-DD format")
    .option("--warranty-months <months>", "Warranty duration in whole months")
    .option("--as-of <date>", "Reference date in YYYY-MM-DD format", currentIsoDate())
    .option("--expiring-within-days <days>", "Expiring-soon window in days", "45")
    .option("--format <format>", "Output format: text or json", "text")
    .action(
      (options: {
        purchaseDate?: string;
        warrantyEnd?: string;
        warrantyMonths?: string;
        asOf: string;
        expiringWithinDays: string;
        format: string;
      }) => {
        const result = calculateWarrantyState({
          purchaseDate: options.purchaseDate,
          warrantyEndDate: options.warrantyEnd,
          warrantyMonths: options.warrantyMonths === undefined ? undefined : Number(options.warrantyMonths),
          referenceDate: options.asOf,
          expiringSoonDays: Number(options.expiringWithinDays)
        });

        if (options.format === "json") {
          console.log(JSON.stringify({ ok: true, result }));
          return;
        }

        const endDateText = result.effectiveEndDate === undefined ? "unknown end date" : `ends ${result.effectiveEndDate}`;
        const warningText =
          result.warnings.length === 0
            ? ""
            : `\nWarnings:\n${result.warnings.map((warning) => `- ${warning.code}: ${warning.message}`).join("\n")}`;

        console.log(`Warranty: ${result.state} (${endDateText})${warningText}`);
      }
    );

  return program;
}

function currentIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatChatParseText(result: ChatItemParseResult): string {
  if (result.kind === "needs_clarification") {
    return `Need clarification: ${result.missing.join(", ")}`;
  }

  const draft = result.draft;
  return [
    "Draft item (confirm before saving)",
    `Name: ${draft.name}`,
    `Category: ${draft.category}`,
    draft.brand === undefined ? undefined : `Brand: ${draft.brand}`,
    draft.location === undefined ? undefined : `Location: ${draft.location}`,
    draft.purchaseDate === undefined ? undefined : `Purchase date: ${draft.purchaseDate}`,
    draft.warrantyEnd === undefined ? undefined : `Warranty end: ${draft.warrantyEnd}`,
    `CLI: ${draft.commandArgs.map(quoteArg).join(" ")}`
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

function formatChatItemsText(intent: ChatItemIntent, items: Array<{ id: string; name: string; category: string; status: string }>): string {
  if (items.length === 0) {
    return intent.kind === "item_list" ? "No items found." : "No matching items found.";
  }
  return items.map((item) => `${item.id} ${item.name} (${item.category}, ${item.status})`).join("\n");
}

async function applyChatMutation(service: ItemService, intent: Exclude<ReturnType<typeof parseChatItemMutationIntent>, { kind: "needs_clarification" }>) {
  if (intent.action === "delete") {
    return service.delete(intent.target);
  }
  if (intent.action === "restore") {
    return service.restore(intent.target);
  }
  if ("patch" in intent) {
    return service.edit(intent.target, intent.patch);
  }
  throw new Error("Chat mutation patch missing.");
}

function parseChatDraftJson(value: string): ChatItemDraft {
  const parsed = JSON.parse(value) as unknown;
  const candidate = isDraftParseResult(parsed) ? parsed.draft : parsed;
  if (!isChatItemDraft(candidate)) {
    throw new Error("Draft JSON must be a chat item draft or chat parse draft result.");
  }
  return candidate;
}

function isDraftParseResult(value: unknown): value is { kind: "draft"; draft: unknown } {
  return typeof value === "object" && value !== null && "kind" in value && value.kind === "draft" && "draft" in value;
}

function isChatItemDraft(value: unknown): value is ChatItemDraft {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "category" in value &&
    typeof value.category === "string" &&
    "needsConfirmation" in value &&
    value.needsConfirmation === true
  );
}

function chatDraftToItemInput(draft: ChatItemDraft): Record<string, unknown> {
  return {
    name: draft.name,
    category: draft.category,
    brand: draft.brand,
    model: draft.model,
    serialNumber: draft.serialNumber,
    location: draft.location,
    owner: draft.owner,
    purchaseDate: draft.purchaseDate,
    purchasePriceMinor: draft.purchasePriceMinor,
    currency: draft.currency,
    merchant: draft.merchant,
    warrantyEnd: draft.warrantyEnd,
    warrantyMonths: draft.warrantyMonths,
    notes: draft.notes
  };
}

function quoteArg(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(value) ? value : JSON.stringify(value);
}

interface ItemCommandOptions {
  db?: string;
  store: string;
  name?: string;
  category?: string;
  status?: string;
  brand?: string;
  model?: string;
  serial?: string;
  location?: string;
  owner?: string;
  purchaseDate?: string;
  purchasePriceMinor?: string;
  currency?: string;
  merchant?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyMonths?: string;
  notes?: string;
  format: string;
}

interface ItemStoreOptions {
  db?: string;
  store: string;
}

function createItemService(options: ItemStoreOptions): ItemService {
  if (options.db !== undefined) {
    return new ItemService({ repository: new SqliteItemRepository(openInventoryDatabase(options.db)) });
  }
  return new ItemService({ repository: new JsonFileItemRepository(options.store) });
}

interface DocumentStoreOptions {
  documentsStore: string;
  attachmentsDir: string;
}

interface DocumentCommandOptions extends DocumentStoreOptions {
  item: string;
  path: string;
  kind: string;
  title?: string;
  notes?: string;
  format: string;
}

function createDocumentService(options: DocumentStoreOptions): DocumentService {
  return new DocumentService({
    repository: new JsonFileDocumentRepository(options.documentsStore),
    storage: new LocalAttachmentStorage(options.attachmentsDir)
  });
}

interface ServiceEventStoreOptions {
  eventsStore: string;
}

interface ServiceEventCommandOptions extends ServiceEventStoreOptions {
  item: string;
  kind: string;
  title: string;
  occurredOn?: string;
  dueOn?: string;
  notes?: string;
  format: string;
}

interface ReminderCommandOptions extends ItemStoreOptions, ServiceEventStoreOptions {
  within: string;
  asOf: string;
  format: string;
}

interface EvidencePackCommandOptions extends ItemStoreOptions, DocumentStoreOptions, ServiceEventStoreOptions {
  item: string;
  output: string;
  within: string;
  asOf: string;
  format: string;
}

function createServiceEventService(options: ServiceEventStoreOptions): ServiceEventService {
  return new ServiceEventService({ repository: new JsonFileServiceEventRepository(options.eventsStore) });
}

function serviceEventInputFromOptions(options: ServiceEventCommandOptions): Record<string, unknown> {
  return {
    itemId: options.item,
    kind: options.kind,
    title: options.title,
    occurredOn: options.occurredOn,
    dueOn: options.dueOn,
    notes: options.notes
  };
}

function documentInputFromOptions(options: DocumentCommandOptions): Record<string, unknown> {
  return {
    itemId: options.item,
    sourcePath: options.path,
    kind: options.kind,
    title: options.title,
    notes: options.notes
  };
}

function itemInputFromOptions(options: ItemCommandOptions): Record<string, unknown> {
  return {
    name: options.name,
    category: options.category,
    status: options.status,
    brand: options.brand,
    model: options.model,
    serialNumber: options.serial,
    location: options.location,
    owner: options.owner,
    purchaseDate: options.purchaseDate,
    purchasePriceMinor: options.purchasePriceMinor === undefined ? undefined : Number(options.purchasePriceMinor),
    currency: options.currency,
    merchant: options.merchant,
    warrantyStart: options.warrantyStart,
    warrantyEnd: options.warrantyEnd,
    warrantyMonths: options.warrantyMonths === undefined ? undefined : Number(options.warrantyMonths),
    notes: options.notes
  };
}

function itemPatchFromOptions(options: ItemCommandOptions): ItemPatch {
  return Object.fromEntries(Object.entries(itemInputFromOptions(options)).filter(([, value]) => value !== undefined)) as ItemPatch;
}

async function runItemAction(format: string, action: () => Promise<string | object>): Promise<void> {
  try {
    const result = await action();
    console.log(typeof result === "string" ? result : JSON.stringify(result));
  } catch (error) {
    const payload = itemErrorPayload(error);
    process.exitCode = payload.error.code === "AMBIGUOUS_ITEM" ? 2 : 1;
    if (format === "json") {
      console.log(JSON.stringify(payload));
      return;
    }
    console.log(`${payload.error.code}: ${payload.error.message}`);
    if (payload.error.candidates.length > 0) {
      console.log(payload.error.candidates.map((candidate) => `- ${candidate.id} ${candidate.name}`).join("\n"));
    }
  }
}

function itemErrorPayload(error: unknown): {
  ok: false;
  error: { code: string; message: string; candidates: Array<{ id: string; name: string; category: string; status: string }> };
} {
  if (isTargetResolutionError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        candidates: error.candidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          category: candidate.category,
          status: candidate.status
        }))
      }
    };
  }
  const message = error instanceof Error ? error.message : "Unexpected item command failure.";
  return { ok: false, error: { code: "ITEM_COMMAND_FAILED", message, candidates: [] } };
}

function isTargetResolutionError(error: unknown): error is TargetResolutionError {
  return error instanceof Error && "code" in error && "candidates" in error;
}

async function runDocumentAction(format: string, action: () => Promise<string | object>): Promise<void> {
  try {
    const result = await action();
    console.log(typeof result === "string" ? result : JSON.stringify(result));
  } catch (error) {
    const payload = documentErrorPayload(error);
    process.exitCode = 1;
    console.log(format === "json" ? JSON.stringify(payload) : `${payload.error.code}: ${payload.error.message}`);
  }
}

function documentErrorPayload(error: unknown): { ok: false; error: { code: string; message: string } } {
  const code = error instanceof Error && "code" in error ? String(error.code) : "DOCUMENT_COMMAND_FAILED";
  const message = error instanceof Error ? error.message : "Unexpected document command failure.";
  return { ok: false, error: { code, message } };
}

async function runSimpleAction(format: string, fallbackCode: string, action: () => Promise<string | object>): Promise<void> {
  try {
    const result = await action();
    console.log(typeof result === "string" ? result : JSON.stringify(result));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : fallbackCode;
    const message = error instanceof Error ? error.message : "Unexpected command failure.";
    process.exitCode = 1;
    console.log(format === "json" ? JSON.stringify({ ok: false, error: { code, message } }) : `${code}: ${message}`);
  }
}

function parseDurationDays(duration: string): number {
  const match = /^(\d+)d$/.exec(duration);
  if (match === null) {
    throw new Error("Duration must use day format such as 45d.");
  }
  return Number(match[1]);
}

function defaultItemStorePath(): string {
  return join(homedir(), ".inventory-control", "items.json");
}

function defaultDocumentStorePath(): string {
  return join(homedir(), ".inventory-control", "documents.json");
}

function defaultAttachmentsDir(): string {
  return join(homedir(), ".inventory-control", "attachments");
}

function defaultServiceEventStorePath(): string {
  return join(homedir(), ".inventory-control", "service-events.json");
}
