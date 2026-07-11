import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("exposes machine-readable capabilities for agent callers", async () => {
    await run("capabilities", "--format", "json");

    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({
      ok: true,
      app: "inventory-control",
      guarantees: {
        structuredJson: true,
        richMessages: true,
        typedErrors: true,
        dryRun: true,
        explicitScopeInJson: true
      },
      commands: expect.arrayContaining([
        expect.objectContaining({ path: "item add", mutates: true, dryRun: true }),
        expect.objectContaining({ path: "export evidence-pack", mutates: true, dryRun: true })
      ])
    });
  });

  it("returns Telegram rich-message payloads with rich-json output", async () => {
    await run(
      "item",
      "add",
      "--store",
      storePath,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--format",
      "rich-json"
    );

    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({
      ok: true,
      data: {
        ok: true,
        item: {
          name: "MacBook Pro",
          category: "laptop"
        }
      },
      richMessage: {
        schemaVersion: 1,
        channel: "telegram",
        title: "Inventory",
        fallbackText: expect.stringContaining("MacBook Pro"),
        presentation: {
          title: "Inventory",
          tone: "info",
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: "text" }),
            expect.objectContaining({ type: "section" })
          ])
        },
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: "section" }),
          expect.objectContaining({ type: "fields" })
        ])
      }
    });
  });

  it("previews item add without writing to the store", async () => {
    await run(
      "item",
      "add",
      "--store",
      storePath,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--dry-run",
      "--format",
      "json"
    );

    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({
      ok: true,
      dryRun: true,
      command: "item.add",
      scope: { storage: "json-file", store: storePath },
      plannedOperations: [{ action: "add_item", item: { name: "MacBook Pro", category: "laptop" } }],
      sideEffects: [],
      warnings: []
    });

    await run("item", "list", "--store", storePath, "--format", "json");
    expect(JSON.parse(output.at(-1) ?? "{}")).toMatchObject({ ok: true, items: [] });
  });

  it("writes a run artifact for dry-run mutation previews", async () => {
    const artifactDir = join(tempDir, "artifacts");

    await run(
      "item",
      "add",
      "--store",
      storePath,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--dry-run",
      "--artifact-dir",
      artifactDir,
      "--format",
      "json"
    );

    const result = JSON.parse(output.at(-1) ?? "{}");
    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      command: "item.add",
      artifactPath: expect.stringContaining(artifactDir)
    });

    const artifact = JSON.parse(await readFile(result.artifactPath, "utf8"));
    expect(artifact).toMatchObject({
      app: "inventory-control",
      version: expect.any(String),
      createdAt: expect.any(String),
      result: {
        ok: true,
        dryRun: true,
        command: "item.add",
        plannedOperations: [{ action: "add_item" }]
      }
    });
  });

  it("writes a run artifact for typed mutation errors", async () => {
    const artifactDir = join(tempDir, "error-artifacts");

    await run(
      "item",
      "delete",
      "missing",
      "--store",
      storePath,
      "--artifact-dir",
      artifactDir,
      "--format",
      "json"
    );

    const result = JSON.parse(output.at(-1) ?? "{}");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "ITEM_NOT_FOUND" },
      artifactPath: expect.stringContaining(artifactDir)
    });
    expect(process.exitCode).toBe(1);

    const artifact = JSON.parse(await readFile(result.artifactPath, "utf8"));
    expect(artifact).toMatchObject({
      result: {
        ok: false,
        error: { code: "ITEM_NOT_FOUND", candidates: [] }
      }
    });
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});
