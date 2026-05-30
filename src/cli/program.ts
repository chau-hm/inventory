import { Command } from "commander";
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
