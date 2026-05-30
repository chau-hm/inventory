import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportEvidencePack, formatEvidencePackForTelegram } from "../../src/application/exporters/evidence-pack.js";
import type { SavedItem } from "../../src/application/items.js";
import type { SavedDocument } from "../../src/domain/document.js";
import type { SavedServiceEvent } from "../../src/domain/service-event.js";

describe("exportEvidencePack", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "inventory-evidence-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("writes a manifest and copies active document files", async () => {
    const storedPath = join(tempDir, "receipt.txt");
    await writeFile(storedPath, "receipt", "utf8");
    const item: SavedItem = {
      id: "itm_1",
      name: "MacBook Pro",
      category: "laptop",
      status: "active",
      warrantyEnd: "2026-06-10",
      createdAt: "2026-05-30T12:00:00Z",
      updatedAt: "2026-05-30T12:00:00Z"
    };
    const document: SavedDocument = {
      id: "doc_1",
      itemId: item.id,
      kind: "receipt",
      status: "active",
      originalPath: storedPath,
      storedPath,
      sha256: "a".repeat(64),
      byteSize: 7,
      mimeType: "text/plain",
      createdAt: "2026-05-30T12:00:00Z",
      updatedAt: "2026-05-30T12:00:00Z"
    };
    const serviceEvent: SavedServiceEvent = {
      id: "evt_1",
      itemId: item.id,
      kind: "maintenance",
      title: "Clean keyboard",
      dueOn: "2026-06-05",
      status: "active",
      createdAt: "2026-05-30T12:00:00Z",
      updatedAt: "2026-05-30T12:00:00Z"
    };

    const result = await exportEvidencePack({
      item,
      documents: [document],
      serviceEvents: [serviceEvent],
      asOf: "2026-05-30",
      outputDir: join(tempDir, "pack")
    });

    const manifest = JSON.parse(await readFile(result.manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      item: { id: item.id, name: "MacBook Pro" },
      documents: [{ id: "doc_1" }],
      serviceEvents: [{ id: "evt_1" }],
      reminders: [{ dedupeKey: "service-event:evt_1:2026-06-05" }, { dedupeKey: "warranty:itm_1:2026-06-10" }]
    });
    await expect(readFile(result.manifest.files[0]?.copiedPath ?? "", "utf8")).resolves.toBe("receipt");
    expect(formatEvidencePackForTelegram(result)).toContain("Evidence pack: MacBook Pro");
  });
});

