import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ServiceEventRepository } from "../application/service-events.js";
import type { SavedServiceEvent } from "../domain/service-event.js";

interface ServiceEventStoreFile {
  events: SavedServiceEvent[];
}

export class JsonFileServiceEventRepository implements ServiceEventRepository {
  constructor(private readonly path: string) {}

  async list(): Promise<SavedServiceEvent[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      if (raw.trim() === "") {
        return [];
      }
      const parsed = JSON.parse(raw) as ServiceEventStoreFile;
      return Array.isArray(parsed.events) ? parsed.events : [];
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async saveAll(events: SavedServiceEvent[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify({ events }, null, 2)}\n`, "utf8");
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

