import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ItemRepository, SavedItem } from "../application/items.js";

interface ItemStoreFile {
  items: SavedItem[];
}

export class JsonFileItemRepository implements ItemRepository {
  constructor(private readonly path: string) {}

  async list(): Promise<SavedItem[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      if (raw.trim() === "") {
        return [];
      }
      const parsed = JSON.parse(raw) as ItemStoreFile;
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async saveAll(items: SavedItem[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ items }, null, 2)}\n`, "utf8");
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
