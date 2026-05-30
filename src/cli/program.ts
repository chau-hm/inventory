import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { JsonFileItemRepository } from "../adapters/json-file-item-repository.js";
import { ItemService, type ItemPatch, type TargetResolutionError } from "../application/items.js";
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

  const item = program.command("item").description("Item-related commands");

  item
    .command("add")
    .description("Add an item to the JSON item store")
    .requiredOption("--name <name>", "Item name")
    .requiredOption("--category <category>", "Item category")
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
        const service = createItemService(options.store);
        const saved = await service.add(itemInputFromOptions(options));
        if (options.format === "json") {
          return { ok: true, item: saved };
        }
        return `Item added: ${saved.id} ${saved.name} (${saved.category}, ${saved.status})`;
      });
    });

  item
    .command("list")
    .description("List items from the JSON item store")
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--status <status>", "Status filter, or all", "active")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (options: { store: string; status: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options.store);
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
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: { store: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options.store);
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
        const service = createItemService(options.store);
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
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: { store: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options.store);
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
    .option("--store <path>", "JSON item store path", defaultItemStorePath())
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (target: string, options: { store: string; format: string }) => {
      await runItemAction(options.format, async () => {
        const service = createItemService(options.store);
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

interface ItemCommandOptions {
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

function createItemService(storePath: string): ItemService {
  return new ItemService({ repository: new JsonFileItemRepository(storePath) });
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
    process.exitCode = 1;
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

function defaultItemStorePath(): string {
  return join(homedir(), ".inventory-control", "items.json");
}
