import { randomUUID } from "node:crypto";
import type { DocumentDraft, DocumentKind, SavedDocument } from "../domain/document.js";
import { validateDocumentDraft, validateSavedDocument } from "../domain/document.js";

export interface DocumentRepository {
  list(): Promise<SavedDocument[]>;
  saveAll(documents: SavedDocument[]): Promise<void>;
}

export interface AttachmentStorage {
  store(input: {
    documentId: string;
    itemId: string;
    sourcePath: string;
  }): Promise<{
    originalPath: string;
    storedPath: string;
    sha256: string;
    byteSize: number;
    mimeType?: string;
  }>;
}

export interface DocumentServiceOptions {
  repository: DocumentRepository;
  storage: AttachmentStorage;
  now?: () => string;
  idGenerator?: () => string;
}

export interface DocumentListOptions {
  itemId?: string;
  status?: "active" | "deleted" | "all";
}

export class DocumentService {
  private readonly repository: DocumentRepository;
  private readonly storage: AttachmentStorage;
  private readonly now: () => string;
  private readonly idGenerator: () => string;

  constructor(options: DocumentServiceOptions) {
    this.repository = options.repository;
    this.storage = options.storage;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idGenerator = options.idGenerator ?? (() => `doc_${randomUUID().replaceAll("-", "").slice(0, 12)}`);
  }

  async attach(input: unknown): Promise<SavedDocument> {
    const draft = validateDocumentDraft(input);
    const timestamp = this.now();
    const id = this.idGenerator();
    const stored = await this.storage.store({ documentId: id, itemId: draft.itemId, sourcePath: draft.sourcePath });
    const document = validateSavedDocument({
      ...draft,
      id,
      status: "active",
      originalPath: stored.originalPath,
      storedPath: stored.storedPath,
      sha256: stored.sha256,
      byteSize: stored.byteSize,
      mimeType: stored.mimeType,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const documents = await this.repository.list();
    await this.repository.saveAll([...documents, document]);
    return document;
  }

  async list(options: DocumentListOptions = {}): Promise<SavedDocument[]> {
    const status = options.status ?? "active";
    const documents = await this.repository.list();
    return documents.filter((document) => {
      const statusMatches = status === "all" || document.status === status;
      const itemMatches = options.itemId === undefined || document.itemId === options.itemId;
      return statusMatches && itemMatches;
    });
  }

  async delete(documentId: string): Promise<SavedDocument> {
    const documents = await this.repository.list();
    const document = documents.find((candidate) => candidate.id === documentId && candidate.status !== "deleted");
    if (document === undefined) {
      throw documentError("DOCUMENT_NOT_FOUND", "Document not found.");
    }
    const timestamp = this.now();
    const deleted = validateSavedDocument({
      ...document,
      status: "deleted",
      deletedAt: timestamp,
      updatedAt: timestamp
    });
    await this.repository.saveAll(documents.map((candidate) => (candidate.id === deleted.id ? deleted : candidate)));
    return deleted;
  }
}

export interface OcrProvider {
  extract(input: SavedDocument): Promise<OcrExtraction>;
}

export interface OcrExtraction {
  rawText: string;
  confidence?: number;
  warnings: string[];
}

export interface DocumentIngestDraft {
  documentId: string;
  itemId: string;
  kind: DocumentKind;
  rawText: string;
  extractedFields: Record<string, string>;
  confidence?: number;
  warnings: string[];
}

export class NoopOcrProvider implements OcrProvider {
  async extract(): Promise<OcrExtraction> {
    return {
      rawText: "",
      warnings: ["OCR provider is not configured for this draft."]
    };
  }
}

export async function createDocumentIngestDraft(input: {
  document: SavedDocument;
  provider: OcrProvider;
}): Promise<DocumentIngestDraft> {
  const extraction = await input.provider.extract(input.document);
  return {
    documentId: input.document.id,
    itemId: input.document.itemId,
    kind: input.document.kind,
    rawText: extraction.rawText,
    extractedFields: {},
    confidence: extraction.confidence,
    warnings: extraction.warnings
  };
}

export interface DocumentServiceError extends Error {
  code: "DOCUMENT_NOT_FOUND";
}

function documentError(code: DocumentServiceError["code"], message: string): DocumentServiceError {
  const error = new Error(message) as DocumentServiceError;
  error.code = code;
  return error;
}

