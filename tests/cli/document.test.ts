import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgram } from "../../src/cli/program.js";

describe("document commands", () => {
  let tempDir: string;
  let documentsStore: string;
  let attachmentsDir: string;
  let sourcePath: string;
  const output: string[] = [];

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-document-cli-"));
    documentsStore = join(tempDir, "documents.json");
    attachmentsDir = join(tempDir, "attachments");
    sourcePath = join(tempDir, "receipt.txt");
    await writeFile(sourcePath, "receipt text", "utf8");
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

  it("attaches, lists, and deletes documents", async () => {
    await run(
      "document",
      "attach",
      "--item",
      "itm_1",
      "--path",
      sourcePath,
      "--kind",
      "receipt",
      "--documents-store",
      documentsStore,
      "--attachments-dir",
      attachmentsDir,
      "--format",
      "json"
    );
    const attached = JSON.parse(output.pop() ?? "{}") as { document: { id: string; storedPath: string } };

    expect(attached.document.id).toMatch(/^doc_/);
    await expect(readFile(attached.document.storedPath, "utf8")).resolves.toBe("receipt text");

    await run("document", "list", "--item", "itm_1", "--documents-store", documentsStore, "--attachments-dir", attachmentsDir, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      documents: [{ id: attached.document.id, itemId: "itm_1", kind: "receipt", status: "active" }]
    });

    await run("document", "delete", attached.document.id, "--documents-store", documentsStore, "--attachments-dir", attachmentsDir, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ document: { id: attached.document.id, status: "deleted" } });

    await run("document", "list", "--item", "itm_1", "--documents-store", documentsStore, "--attachments-dir", attachmentsDir, "--format", "json");
    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({ documents: [] });
  });

  it("creates an OCR ingest draft without confirmed item fields", async () => {
    await run(
      "document",
      "ingest-draft",
      "--item",
      "itm_1",
      "--path",
      sourcePath,
      "--kind",
      "warranty",
      "--documents-store",
      documentsStore,
      "--attachments-dir",
      attachmentsDir,
      "--format",
      "json"
    );

    expect(JSON.parse(output.pop() ?? "{}")).toMatchObject({
      ok: true,
      document: { itemId: "itm_1", kind: "warranty" },
      draft: {
        itemId: "itm_1",
        kind: "warranty",
        rawText: "",
        extractedFields: {},
        warnings: ["OCR provider is not configured for this draft."]
      }
    });
  });

  async function run(...args: string[]): Promise<void> {
    await createProgram().parseAsync(["node", "inventory", ...args], { from: "node" });
  }
});

