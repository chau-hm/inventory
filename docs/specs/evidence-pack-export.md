# Evidence Pack Export Slice

## Goal

Export a local evidence folder for one item so an agent can quickly gather item facts, warranty dates, attached files, service timeline, and due reminders.

## Scope

- Export a folder, not a zip archive.
- Write `evidence-pack.json` with stable JSON fields.
- Copy active attached documents into an `attachments/` subfolder.
- Include active service events and calculated reminders.
- Provide a Telegram-friendly text summary.

## Non-goals

- PDF generation.
- Compression.
- Cloud upload.
- Redaction policy.

## Acceptance

- `export evidence-pack --item <target> --output <dir>` creates the folder.
- Manifest includes `item`, `documents`, `serviceEvents`, `reminders`, and copied `files`.
- Deleted documents and deleted service events are excluded.
- JSON CLI output uses `{ ok: true, result }`.

