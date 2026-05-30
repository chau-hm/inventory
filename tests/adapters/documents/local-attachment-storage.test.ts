import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalAttachmentStorage } from "../../../src/adapters/documents/local-attachment-storage.js";

describe("LocalAttachmentStorage", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-docs-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("copies source files under the item attachment folder", async () => {
    const sourcePath = join(tempDir, "receipt.txt");
    const attachmentRoot = join(tempDir, "attachments");
    await writeFile(sourcePath, "hello receipt", "utf8");

    const result = await new LocalAttachmentStorage(attachmentRoot).store({
      documentId: "doc_1",
      itemId: "itm/unsafe",
      sourcePath
    });

    expect(result).toMatchObject({
      originalPath: sourcePath,
      storedPath: join(attachmentRoot, "itm_unsafe", "doc_1.txt"),
      byteSize: 13,
      mimeType: "text/plain"
    });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(readFile(result.storedPath, "utf8")).resolves.toBe("hello receipt");
  });
});

