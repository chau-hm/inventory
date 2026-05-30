import { describe, expect, it } from "vitest";
import { calculateDueReminders } from "../../src/application/reminders.js";
import type { SavedItem } from "../../src/application/items.js";
import type { SavedServiceEvent } from "../../src/domain/service-event.js";

const baseItem: SavedItem = {
  id: "itm_1",
  name: "MacBook Pro",
  category: "laptop",
  status: "active",
  warrantyEnd: "2026-06-10",
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z"
};

const baseEvent: SavedServiceEvent = {
  id: "evt_1",
  itemId: "itm_1",
  kind: "maintenance",
  title: "Clean keyboard",
  dueOn: "2026-06-05",
  status: "active",
  createdAt: "2026-05-01T00:00:00Z",
  updatedAt: "2026-05-01T00:00:00Z"
};

describe("calculateDueReminders", () => {
  it("returns warranty and service-event reminders with dedupe keys", () => {
    const reminders = calculateDueReminders({
      items: [baseItem],
      serviceEvents: [baseEvent],
      asOf: "2026-05-30",
      withinDays: 45
    });

    expect(reminders).toEqual([
      expect.objectContaining({
        kind: "service_event_due",
        itemId: "itm_1",
        dueOn: "2026-06-05",
        daysUntilDue: 6,
        dedupeKey: "service-event:evt_1:2026-06-05"
      }),
      expect.objectContaining({
        kind: "warranty_expiring",
        itemId: "itm_1",
        dueOn: "2026-06-10",
        daysUntilDue: 11,
        dedupeKey: "warranty:itm_1:2026-06-10"
      })
    ]);
  });

  it("marks overdue reminders and ignores deleted records", () => {
    const reminders = calculateDueReminders({
      items: [{ ...baseItem, status: "deleted", deletedAt: "2026-05-01T00:00:00Z" }],
      serviceEvents: [{ ...baseEvent, dueOn: "2026-05-01" }],
      asOf: "2026-05-30",
      withinDays: 45
    });

    expect(reminders).toEqual([
      expect.objectContaining({
        kind: "service_event_overdue",
        daysUntilDue: -29
      })
    ]);
  });
});

