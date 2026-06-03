import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("export evidence-pack command", () => {
  let tempDir: string;
  let itemStore: string;
  let documentStore: string;
  let attachmentsDir: string;
  let eventStore: string;
  let sourcePath: string;
  let outputDir: string;
  const output: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-export-cli-"));
    itemStore = join(tempDir, "items.json");
    documentStore = join(tempDir, "documents.json");
    attachmentsDir = join(tempDir, "attachments");
    eventStore = join(tempDir, "events.json");
    sourcePath = join(tempDir, "receipt.txt");
    outputDir = join(tempDir, "pack");
    await writeFile(sourcePath, "receipt", "utf8");
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

  it("exports item, documents, service events, reminders, and copied files", async () => {
    await run(
      "item",
      "add",
      "--store",
      itemStore,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--warranty-end",
      "2026-06-10",
      "--format",
      "json"
    );
    const itemId = (JSON.parse(output.pop() ?? "{}") as { item: { id: string } }).item.id;

    await run(
      "document",
      "attach",
      "--item",
      itemId,
      "--path",
      sourcePath,
      "--kind",
      "receipt",
      "--documents-store",
      documentStore,
      "--attachments-dir",
      attachmentsDir,
      "--format",
      "json"
    );
    output.pop();

    await run(
      "service-event",
      "add",
      "--item",
      itemId,
      "--kind",
      "maintenance",
      "--title",
      "Clean keyboard",
      "--due-on",
      "2026-06-05",
      "--events-store",
      eventStore,
      "--format",
      "json"
    );
    output.pop();

    await run(
      "export",
      "evidence-pack",
      "--item",
      itemId,
      "--output",
      outputDir,
      "--store",
      itemStore,
      "--documents-store",
      documentStore,
      "--attachments-dir",
      attachmentsDir,
      "--events-store",
      eventStore,
      "--as-of",
      "2026-05-30",
      "--format",
      "json"
    );

    const result = JSON.parse(output.pop() ?? "{}");
    expect(result).toMatchObject({
      ok: true,
      result: {
        manifest: {
          item: { id: itemId },
          documents: [{ kind: "receipt" }],
          serviceEvents: [{ title: "Clean keyboard" }],
          reminders: [{ kind: "service_event_due" }, { kind: "warranty_expiring" }]
        }
      }
    });
    const manifest = JSON.parse(await readFile(join(outputDir, "evidence-pack.json"), "utf8"));
    expect(manifest.files).toHaveLength(1);
    await expect(readFile(manifest.files[0].copiedPath, "utf8")).resolves.toBe("receipt");
  });

  it("previews evidence-pack export without writing the output folder", async () => {
    await run(
      "item",
      "add",
      "--store",
      itemStore,
      "--name",
      "MacBook Pro",
      "--category",
      "laptop",
      "--format",
      "json"
    );
    const itemId = (JSON.parse(output.pop() ?? "{}") as { item: { id: string } }).item.id;

    await run(
      "export",
      "evidence-pack",
      "--item",
      itemId,
      "--output",
      outputDir,
      "--store",
      itemStore,
      "--documents-store",
      documentStore,
      "--attachments-dir",
      attachmentsDir,
      "--events-store",
      eventStore,
      "--dry-run",
      "--format",
      "json"
    );

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      ok: true,
      dryRun: true,
      command: "export.evidence-pack",
      scope: { itemId, outputDir },
      plannedOperations: [
        {
          action: "export_evidence_pack",
          itemId,
          documentCount: 0,
          serviceEventCount: 0,
          outputDir
        }
      ],
      sideEffects: []
    });

    await expect(readFile(join(outputDir, "evidence-pack.json"), "utf8")).rejects.toThrow();
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});
