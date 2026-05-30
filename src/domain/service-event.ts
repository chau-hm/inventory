import { z } from "zod";

export const serviceEventKinds = ["maintenance", "repair", "warranty_claim", "inspection", "cleaning", "other"] as const;
export const serviceEventStatuses = ["active", "deleted"] as const;

export type ServiceEventKind = (typeof serviceEventKinds)[number];
export type ServiceEventStatus = (typeof serviceEventStatuses)[number];

export interface ServiceEventDraft {
  itemId: string;
  kind: ServiceEventKind;
  title: string;
  occurredOn?: string;
  dueOn?: string;
  notes?: string;
}

export interface SavedServiceEvent extends ServiceEventDraft {
  id: string;
  status: ServiceEventStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const trimmedString = z.string().trim().min(1);
const trimmedOptionalString = trimmedString.optional();

export const serviceEventDraftSchema = z
  .object({
    itemId: trimmedString,
    kind: z.enum(serviceEventKinds),
    title: trimmedString,
    occurredOn: z.string().regex(isoDatePattern, "occurredOn must use YYYY-MM-DD.").optional(),
    dueOn: z.string().regex(isoDatePattern, "dueOn must use YYYY-MM-DD.").optional(),
    notes: trimmedOptionalString
  })
  .superRefine((event, context) => {
    if (event.occurredOn === undefined && event.dueOn === undefined) {
      context.addIssue({
        code: "custom",
        path: ["dueOn"],
        message: "Either occurredOn or dueOn is required."
      });
    }
  });

export const savedServiceEventSchema = serviceEventDraftSchema
  .extend({
    id: trimmedString,
    status: z.enum(serviceEventStatuses),
    createdAt: z.string().regex(isoDateTimePattern),
    updatedAt: z.string().regex(isoDateTimePattern),
    deletedAt: z.string().regex(isoDateTimePattern).optional()
  })
  .superRefine((event, context) => {
    if (event.status === "deleted" && event.deletedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt is required when service event status is deleted."
      });
    }
    if (event.status !== "deleted" && event.deletedAt !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["deletedAt"],
        message: "deletedAt must be omitted unless service event status is deleted."
      });
    }
  });

export function validateServiceEventDraft(input: unknown): ServiceEventDraft {
  return serviceEventDraftSchema.parse(input);
}

export function validateSavedServiceEvent(input: unknown): SavedServiceEvent {
  return savedServiceEventSchema.parse(input);
}

