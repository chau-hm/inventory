import { Command } from "commander";
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
