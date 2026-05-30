import { z } from "zod";

export const documentKinds = ["receipt", "warranty", "manual", "photo", "service_record", "other"] as const;
export const documentStatuses = ["active", "deleted"] as const;

export type DocumentKind = (typeof documentKinds)[number];
export type DocumentStatus = (typeof documentStatuses)[number];

export interface DocumentDraft {
  itemId: string;
  kind: DocumentKind;
  sourcePath: string;
  title?: string;
  notes?: string;
}

export interface SavedDocument extends Omit<DocumentDraft, "sourcePath"> {
  id: string;
  status: DocumentStatus;
  originalPath: string;
  storedPath: string;
  sha256: string;
  byteSize: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const trimmedString = z.string().trim().min(1);
const trimmedOptionalString = trimmedString.optional();

export const documentDraftSchema = z.object({
  itemId: trimmedString,
  kind: z.enum(documentKinds),
  sourcePath: trimmedString,
  title: trimmedOptionalString,
  notes: trimmedOptionalString
});

export const savedDocumentSchema = z
  .object({
    id: trimmedString,
    itemId: trimmedString,
    kind: z.enum(documentKinds),
    status: z.enum(documentStatuses),
    originalPath: trimmedString,
    storedPath: trimmedString,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    byteSize: z.number().int().nonnegative(),
    mimeType: trimmedOptionalString,
    title: trimmedOptionalString,
    notes: trimmedOptionalString,
    createdAt: z.string().regex(isoDateTimePattern),
    updatedAt: z.string().regex(isoDateTimePattern),
    deletedAt: z.string().regex(isoDateTimePattern).optional()
  })
  .superRefine((document, context) => {
    if (document.status === "deleted" && document.deletedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt is required when document status is deleted."
      });
    }
    if (document.status !== "deleted" && document.deletedAt !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt must be omitted unless document status is deleted."
      });
    }
  });

export function validateDocumentDraft(input: unknown): DocumentDraft {
  return documentDraftSchema.parse(input);
}

export function validateSavedDocument(input: unknown): SavedDocument {
  return savedDocumentSchema.parse(input);
}

