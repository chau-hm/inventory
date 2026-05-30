# Service Events And Reminder Due Slice

## Goal

Track item service timeline entries and produce a deterministic due-reminder list for warranty and scheduled service dates.

## Scope

- Add service events with occurred and/or due dates.
- List and soft-delete service events.
- Calculate reminders for:
  - warranty expiring or expired
  - service events due or overdue
- Include idempotent `dedupeKey` values in reminder output.

## Non-goals

- Push notifications.
- Apple Reminders integration.
- Cron scheduling.
- Recurrence rules.

## Acceptance

- `service-event add/list/delete` stores timeline metadata locally.
- `reminder due --within 45d` returns due warranty and service reminders.
- Reminder output includes `dedupeKey`, `kind`, `itemId`, `dueOn`, and `daysUntilDue`.
- Deleted items and deleted service events do not produce active reminders.

