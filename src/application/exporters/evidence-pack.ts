import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SavedDocument } from "../../domain/document.js";
import type { SavedServiceEvent } from "../../domain/service-event.js";
import type { SavedItem } from "../items.js";
import { calculateDueReminders, type Reminder } from "../reminders.js";

export interface EvidencePackInput {
  item: SavedItem;
  documents: SavedDocument[];
  serviceEvents: SavedServiceEvent[];
  asOf: string;
  reminderWithinDays?: number;
  outputDir: string;
}

export interface EvidencePackManifest {
  version: 1;
  generatedAt: string;
  item: SavedItem;
  documents: SavedDocument[];
  serviceEvents: SavedServiceEvent[];
  reminders: Reminder[];
  files: Array<{ documentId: string; sourcePath: string; copiedPath: string }>;
}

export interface EvidencePackResult {
  outputDir: string;
  manifestPath: string;
  manifest: EvidencePackManifest;
}

export async function exportEvidencePack(input: EvidencePackInput): Promise<EvidencePackResult> {
  const attachmentsDir = join(input.outputDir, "attachments");
  await mkdir(attachmentsDir, { recursive: true });

  const files: EvidencePackManifest["files"] = [];
  for (const document of input.documents.filter((candidate) => candidate.status !== "deleted")) {
    const copiedPath = join(attachmentsDir, `${document.id}-${basename(document.storedPath)}`);
    await copyFile(document.storedPath, copiedPath);
    files.push({ documentId: document.id, sourcePath: document.storedPath, copiedPath });
  }

  const manifest: EvidencePackManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    item: input.item,
    documents: input.documents.filter((document) => document.status !== "deleted"),
    serviceEvents: input.serviceEvents.filter((event) => event.status !== "deleted"),
    reminders: calculateDueReminders({
      items: [input.item],
      serviceEvents: input.serviceEvents,
      asOf: input.asOf,
      withinDays: input.reminderWithinDays ?? 45
    }),
    files
  };
  const manifestPath = join(input.outputDir, "evidence-pack.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { outputDir: input.outputDir, manifestPath, manifest };
}

export function formatEvidencePackForTelegram(result: EvidencePackResult): string {
  return [
    `Evidence pack: ${result.manifest.item.name}`,
    `Output: ${result.outputDir}`,
    `Documents: ${result.manifest.documents.length}`,
    `Service events: ${result.manifest.serviceEvents.length}`,
    `Reminders: ${result.manifest.reminders.length}`
  ].join("\n");
}

