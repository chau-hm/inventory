---
name: inventory
description: "Run the local agent-native inventory tracker from OpenClaw or Telegram. Use for /inventory requests, warranty-aware item CRUD, documents, OCR drafts, service events, reminders, and evidence pack exports."
---

# Inventory Control

Use the local TypeScript CLI from the project repo:

```bash
cd /Users/openclaw/Desktop/VirtualBuddyShared/VirtualBuddyShared/repo/inventory
npm run build
node dist/cli/index.js ...
```

Default local data paths:

- Items JSON fallback: `~/.inventory-control/items.json`
- SQLite items DB when requested: pass `--db /path/to/inventory.sqlite`
- Documents metadata: `~/.inventory-control/documents.json`
- Attachments: `~/.inventory-control/attachments`
- Service events: `~/.inventory-control/service-events.json`

## Workflow

1. If the user supplies exact `/inventory` arguments, translate them directly to `node dist/cli/index.js`.
2. If the user writes a natural-language item add request, first run `chat parse "<text>" --format json`.
3. If the user writes a natural-language list/search request, run `chat items "<text>" --format json`.
4. If the user writes a natural-language edit/delete/restore request, run `chat mutate "<text>" --format json`; ambiguous targets return candidates and must not be retried as a mutation without clarification.
5. `chat parse` is non-mutating. Show the draft and equivalent command; save with `chat confirm --draft-json '<json>' --format json` only when the user confirms or when their wording explicitly asks you to save after the draft is unambiguous.
6. Prefer `--format json` for internal reads, then reply with a concise Cantonese summary and saved IDs.
7. Before direct edit/delete/restore, list or detail candidates unless the user gives an exact stable ID.
8. If a target is ambiguous, do not mutate. Show the likely candidates and ask one short clarification.
9. Document OCR is only a draft contract for now. `document ingest-draft` uses the noop OCR provider and should be described as not yet Apple Vision-backed.
10. Evidence packs are local folders. Tell the user the output path and include the manifest path.
11. Run `./scripts/preflight.sh` after code or skill changes that affect the inventory app.

## Common Commands

```bash
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --brand Apple --serial C02XXX --warranty-end 2027-05-30 --format json
node dist/cli/index.js chat parse "記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房" --format json
node dist/cli/index.js chat confirm --draft-json '{"kind":"draft","draft":{"name":"MacBook Pro","category":"laptop","needsConfirmation":true,"sourceText":"...","commandArgs":[]}}' --format json
node dist/cli/index.js chat items "搵 MacBook" --format json
node dist/cli/index.js chat mutate "edit MacBook 改做 location: 書房" --format json
node dist/cli/index.js item list --format json
node dist/cli/index.js item detail itm_123 --format json
node dist/cli/index.js item edit itm_123 --location Study --format json
node dist/cli/index.js item delete itm_123 --format json
node dist/cli/index.js item restore itm_123 --format json
node dist/cli/index.js warranty check --warranty-end 2027-05-30 --format json
node dist/cli/index.js document attach --item itm_123 --path /path/to/receipt.jpg --kind receipt --format json
node dist/cli/index.js document list --item itm_123 --format json
node dist/cli/index.js document ingest-draft --item itm_123 --path /path/to/warranty.pdf --kind warranty --format json
node dist/cli/index.js service-event add --item itm_123 --kind maintenance --title "Clean keyboard" --due-on 2026-06-05 --format json
node dist/cli/index.js service-event list --item itm_123 --format json
node dist/cli/index.js reminder due --within 45d --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --format telegram
./scripts/preflight.sh
```

Reply in Traditional Chinese/Cantonese by default. Keep outputs short, but always include stable IDs for future edits, deletes, restores, document attachment, service events, and evidence exports.
