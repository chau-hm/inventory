import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { DocumentRepository } from "../../application/documents.js";
import type { SavedDocument } from "../../domain/document.js";

interface DocumentStoreFile {
  documents: SavedDocument[];
}

export class JsonFileDocumentRepository implements DocumentRepository {
  constructor(private readonly path: string) {}

  async list(): Promise<SavedDocument[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      if (raw.trim() === "") {
        return [];
      }
      const parsed = JSON.parse(raw) as DocumentStoreFile;
      return Array.isArray(parsed.documents) ? parsed.documents : [];
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async saveAll(documents: SavedDocument[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ documents }, null, 2)}\n`, "utf8");
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

