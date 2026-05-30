import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type { AttachmentStorage } from "../../application/documents.js";

export class LocalAttachmentStorage implements AttachmentStorage {
  constructor(private readonly rootDir: string) {}

  async store(input: { documentId: string; itemId: string; sourcePath: string }): Promise<{
    originalPath: string;
    storedPath: string;
    sha256: string;
    byteSize: number;
    mimeType?: string;
  }> {
    const originalPath = resolve(input.sourcePath);
    const bytes = await readFile(originalPath);
    const metadata = await stat(originalPath);
    const itemDir = join(this.rootDir, sanitizePathPart(input.itemId));
    await mkdir(itemDir, { recursive: true });
    const extension = extname(originalPath);
    const storedPath = join(itemDir, `${sanitizePathPart(input.documentId)}${extension}`);
    await copyFile(originalPath, storedPath);

    return {
      originalPath,
      storedPath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteSize: metadata.size,
      mimeType: mimeTypeFromPath(originalPath)
    };
  }
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function mimeTypeFromPath(path: string): string | undefined {
  const extension = extname(basename(path)).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".txt") return "text/plain";
  return undefined;
}

