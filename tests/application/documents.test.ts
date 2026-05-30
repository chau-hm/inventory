import { describe, expect, it } from "vitest";
import {
  createDocumentIngestDraft,
  DocumentService,
  NoopOcrProvider,
  type AttachmentStorage,
  type DocumentRepository
} from "../../src/application/documents.js";
import type { SavedDocument } from "../../src/domain/document.js";

class MemoryDocumentRepository implements DocumentRepository {
  documents: SavedDocument[] = [];

  async list(): Promise<SavedDocument[]> {
    return this.documents;
  }

  async saveAll(documents: SavedDocument[]): Promise<void> {
    this.documents = documents;
  }
}

class FakeAttachmentStorage implements AttachmentStorage {
  async store(input: { documentId: string; itemId: string; sourcePath: string }): Promise<{
    originalPath: string;
    storedPath: string;
    sha256: string;
    byteSize: number;
    mimeType?: string;
  }> {
    return {
      originalPath: input.sourcePath,
      storedPath: `/attachments/${input.itemId}/${input.documentId}.txt`,
      sha256: "a".repeat(64),
      byteSize: 123,
      mimeType: "text/plain"
    };
  }
}

function createService(repository = new MemoryDocumentRepository()): {
  repository: MemoryDocumentRepository;
  service: DocumentService;
} {
  let id = 0;
  return {
    repository,
    service: new DocumentService({
      repository,
      storage: new FakeAttachmentStorage(),
      now: () => "2026-05-30T12:00:00Z",
      idGenerator: () => `doc_test_${++id}`
    })
  };
}

describe("DocumentService", () => {
  it("attaches and lists active documents", async () => {
    const { service } = createService();

    const document = await service.attach({
      itemId: "itm_1",
      kind: "receipt",
      sourcePath: "/tmp/receipt.txt",
      title: "Apple receipt"
    });

    expect(document).toMatchObject({
      id: "doc_test_1",
      itemId: "itm_1",
      kind: "receipt",
      status: "active",
      sha256: "a".repeat(64),
      title: "Apple receipt"
    });
    await expect(service.list({ itemId: "itm_1" })).resolves.toEqual([document]);
  });

  it("soft deletes documents without returning them in active lists", async () => {
    const { service } = createService();
    const document = await service.attach({ itemId: "itm_1", kind: "manual", sourcePath: "/tmp/manual.txt" });

    const deleted = await service.delete(document.id);

    expect(deleted).toMatchObject({ id: document.id, status: "deleted", deletedAt: "2026-05-30T12:00:00Z" });
    await expect(service.list()).resolves.toEqual([]);
    await expect(service.list({ status: "deleted" })).resolves.toEqual([deleted]);
  });

  it("creates OCR ingest drafts without confirming fields onto items", async () => {
    const { service } = createService();
    const document = await service.attach({ itemId: "itm_1", kind: "warranty", sourcePath: "/tmp/warranty.txt" });

    const draft = await createDocumentIngestDraft({ document, provider: new NoopOcrProvider() });

    expect(draft).toEqual({
      documentId: document.id,
      itemId: "itm_1",
      kind: "warranty",
      rawText: "",
      extractedFields: {},
      warnings: ["OCR provider is not configured for this draft."]
    });
  });
});

