import { z } from "zod";

export const itemStatuses = ["active", "archived", "sold", "disposed", "lost", "deleted"] as const;

export type ItemStatus = (typeof itemStatuses)[number];

export interface ItemDraft {
  id?: string;
  name: string;
  category: string;
  status: ItemStatus;
  brand?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  owner?: string;
  purchaseDate?: string;
  purchasePriceMinor?: number;
  currency?: string;
  merchant?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyMonths?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const currencyPattern = /^[A-Z]{3}$/;

const trimmedOptionalString = z
  .string()
  .trim()
  .min(1)
  .optional();

export const itemDraftSchema = z
  .object({
    id: trimmedOptionalString,
    name: z.string().trim().min(1, "Item name is required."),
    category: z.string().trim().min(1, "Item category is required."),
    status: z.enum(itemStatuses).default("active"),
    brand: trimmedOptionalString,
    model: trimmedOptionalString,
    serialNumber: trimmedOptionalString,
    location: trimmedOptionalString,
    owner: trimmedOptionalString,
    purchaseDate: z.string().regex(isoDatePattern, "Purchase date must use YYYY-MM-DD.").optional(),
    purchasePriceMinor: z.number().int().nonnegative().optional(),
    currency: z.string().regex(currencyPattern, "Currency must be a three-letter uppercase code.").optional(),
    merchant: trimmedOptionalString,
    warrantyStart: z.string().regex(isoDatePattern, "Warranty start must use YYYY-MM-DD.").optional(),
    warrantyEnd: z.string().regex(isoDatePattern, "Warranty end must use YYYY-MM-DD.").optional(),
    warrantyMonths: z.number().int().nonnegative().optional(),
    notes: trimmedOptionalString,
    createdAt: z.string().regex(isoDateTimePattern, "createdAt must be an ISO datetime.").optional(),
    updatedAt: z.string().regex(isoDateTimePattern, "updatedAt must be an ISO datetime.").optional(),
    deletedAt: z.string().regex(isoDateTimePattern, "deletedAt must be an ISO datetime.").optional()
  })
  .superRefine((draft, context) => {
    if (draft.purchasePriceMinor !== undefined && draft.currency === undefined) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Currency is required when purchase price is present."
      });
    }

    if (draft.status === "deleted" && draft.deletedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt is required when item status is deleted."
      });
    }

    if (draft.status !== "deleted" && draft.deletedAt !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt must be omitted unless item status is deleted."
      });
    }
  });

export function validateItemDraft(input: unknown): ItemDraft {
  return itemDraftSchema.parse(input);
}

