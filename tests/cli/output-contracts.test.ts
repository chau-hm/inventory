import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("CLI output contracts", () => {
  let tempDir: string;
  let storePath: string;
  let documentsStorePath: string;
  let attachmentsDir: string;
  let eventsStorePath: string;
  const output: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-contracts-"));
    storePath = join(tempDir, "items.json");
    documentsStorePath = join(tempDir, "documents.json");
    attachmentsDir = join(tempDir, "attachments");
    eventsStorePath = join(tempDir, "events.json");
    process.exitCode = undefined;
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      output.push(String(message));
    });
  });

  afterEach(async () => {
    output.length = 0;
    vi.restoreAllMocks();
    process.exitCode = undefined;
    await rm(tempDir, { force: true, recursive: true });
  });

  it("keeps item add JSON stable for agent callers", async () => {
    await run(
      "item",
      "add",
      "--store",
      storePath,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--brand",
      "Apple",
      "--format",
      "json"
    );

    const result = JSON.parse(output.at(-1) ?? "{}");
    expect(result).toMatchObject({
      ok: true,
      item: {
        name: "MacBook Pro",
        category: "laptop",
        status: "active",
        brand: "Apple"
      }
    });
    expect(result.item.id).toMatch(/^itm_/);
    expect(result.item.createdAt).toEqual(expect.any(String));
    expect(result.item.updatedAt).toEqual(expect.any(String));
  });

  it("keeps missing item errors stable", async () => {
    await run("item", "detail", "missing", "--store", storePath, "--format", "json");

    expect(JSON.parse(output.at(-1) ?? "{}")).toEqual({
      ok: false,
      error: {
        code: "ITEM_NOT_FOUND",
        message: "Item not found.",
        candidates: []
      }
    });
    expect(process.exitCode).toBe(1);
  });

  it("keeps document ingest draft JSON explicit about the noop OCR provider", async () => {
    const sourcePath = join(tempDir, "receipt.txt");
    await writeFile(sourcePath, "receipt");

    await run(
      "document",
      "ingest-draft",
      "--item",
      "itm_contract",
      "--path",
      sourcePath,
      "--kind",
      "receipt",
      "--documents-store",
      documentsStorePath,
      "--attachments-dir",
      attachmentsDir,
      "--format",
      "json"
    );

    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({
      ok: true,
      document: {
        itemId: "itm_contract",
        kind: "receipt",
        status: "active"
      },
      draft: {
        extractedFields: {},
        warnings: ["OCR provider is not configured for this draft."]
      }
    });
  });

  it("keeps reminder due JSON as a list with dedupe keys", async () => {
    await run(
      "item",
      "add",
      "--store",
      storePath,
      "--name",
      "Camera",
      "--category",
      "camera",
      "--warranty-end",
      "2026-06-10",
      "--format",
      "json"
    );
    const item = JSON.parse(output.at(-1) ?? "{}") as { item: { id: string } };

    await run(
      "service-event",
      "add",
      "--events-store",
      eventsStorePath,
      "--item",
      item.item.id,
      "--kind",
      "maintenance",
      "--title",
      "Sensor clean",
      "--due-on",
      "2026-06-05",
      "--format",
      "json"
    );

    await run(
      "reminder",
      "due",
      "--store",
      storePath,
      "--events-store",
      eventsStorePath,
      "--as-of",
      "2026-05-30",
      "--within",
      "45d",
      "--format",
      "json"
    );

    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({
      ok: true,
      reminders: [
        { kind: "service_event_due", dedupeKey: expect.stringMatching(/^service-event:/) },
        { kind: "warranty_expiring", dedupeKey: `warranty:${item.item.id}:2026-06-10` }
      ]
    });
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});
