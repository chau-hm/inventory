import type { SavedItem } from "./items.js";
import type { SavedServiceEvent } from "../domain/service-event.js";
import { calculateWarrantyState } from "../domain/warranty.js";

export type ReminderKind = "warranty_expiring" | "warranty_expired" | "service_event_due" | "service_event_overdue";

export interface Reminder {
  kind: ReminderKind;
  itemId: string;
  itemName?: string;
  dueOn: string;
  daysUntilDue: number;
  dedupeKey: string;
  sourceId?: string;
  title: string;
}

export interface ReminderInput {
  items: SavedItem[];
  serviceEvents: SavedServiceEvent[];
  asOf: string;
  withinDays: number;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function calculateDueReminders(input: ReminderInput): Reminder[] {
  const itemNameById = new Map(input.items.map((item) => [item.id, item.name]));
  const reminders: Reminder[] = [];

  for (const item of input.items.filter((candidate) => candidate.status !== "deleted")) {
    const warranty = calculateWarrantyState({
      purchaseDate: item.purchaseDate,
      warrantyEndDate: item.warrantyEnd,
      warrantyMonths: item.warrantyMonths,
      referenceDate: input.asOf,
      expiringSoonDays: input.withinDays
    });
    if (warranty.effectiveEndDate === undefined || warranty.daysUntilEnd === undefined) continue;
    if (warranty.daysUntilEnd <= input.withinDays) {
      const kind = warranty.daysUntilEnd < 0 ? "warranty_expired" : "warranty_expiring";
      reminders.push({
        kind,
        itemId: item.id,
        itemName: item.name,
        dueOn: warranty.effectiveEndDate,
        daysUntilDue: warranty.daysUntilEnd,
        dedupeKey: `warranty:${item.id}:${warranty.effectiveEndDate}`,
        title: `${item.name} warranty ${kind === "warranty_expired" ? "expired" : "expires"}`
      });
    }
  }

  for (const event of input.serviceEvents.filter((candidate) => candidate.status !== "deleted" && candidate.dueOn !== undefined)) {
    const dueOn = event.dueOn as string;
    const daysUntilDue = differenceInCalendarDays(dueOn, input.asOf);
    if (daysUntilDue <= input.withinDays) {
      const itemName = itemNameById.get(event.itemId);
      const kind = daysUntilDue < 0 ? "service_event_overdue" : "service_event_due";
      reminders.push({
        kind,
        itemId: event.itemId,
        itemName,
        dueOn,
        daysUntilDue,
        sourceId: event.id,
        dedupeKey: `service-event:${event.id}:${dueOn}`,
        title: itemName === undefined ? event.title : `${itemName}: ${event.title}`
      });
    }
  }

  return reminders.sort((left, right) => left.dueOn.localeCompare(right.dueOn) || left.dedupeKey.localeCompare(right.dedupeKey));
}

function differenceInCalendarDays(leftDateText: string, rightDateText: string): number {
  const left = parseUtcDate(leftDateText);
  const right = parseUtcDate(rightDateText);
  return Math.round((left.getTime() - right.getTime()) / millisecondsPerDay);
}

function parseUtcDate(dateText: string): Date {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(Date.UTC(year as number, (month as number) - 1, day));
}

