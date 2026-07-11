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
2. If the user writes a natural-language item add request, first run `chat parse "<text>" --format rich-json`.
3. If the user writes a natural-language list/search request, run `chat items "<text>" --format rich-json`.
4. If the user writes a natural-language edit/delete/restore request, run `chat mutate "<text>" --format rich-json`; ambiguous targets return candidates and must not be retried as a mutation without clarification.
5. `chat parse` is non-mutating. Show the draft and equivalent command; save with `chat confirm --draft-json '<json>' --format rich-json` only when the user confirms or when their wording explicitly asks you to save after the draft is unambiguous. The draft is under `data` when using rich output.
6. Prefer `--format rich-json` for user-visible Telegram/OpenClaw replies. Use `data` for stable IDs and validation, and `richMessage.fallbackText` plus `richMessage.presentation` for the visible response. Use `--format json` for internal-only reads when no user-facing response is needed.
7. Before direct edit/delete/restore, list or detail candidates unless the user gives an exact stable ID.
8. If a target is ambiguous, do not mutate. Show the likely candidates and ask one short clarification.
9. Document OCR is only a draft contract for now. `document ingest-draft` uses the noop OCR provider and should be described as not yet Apple Vision-backed.
10. Evidence packs are local folders. Tell the user the output path and include the manifest path.
11. Use `--dry-run --format rich-json` before risky direct mutations when the user asks to preview, when scope is broad, or when operating from automation. Dry-run rich JSON includes `data.scope`, `data.plannedOperations`, `data.sideEffects`, and `data.warnings`.
12. Use `--artifact-dir <dir>` when provenance matters. Mutation success, dry-run, and typed errors write a compact run receipt, and rich JSON output includes `data.artifactPath` when applicable.
13. `capabilities --format json` is available for machine-readable command discovery.
14. Run `./scripts/preflight.sh` after code or skill changes that affect the inventory app.

## Common Commands

```bash
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --brand Apple --serial C02XXX --warranty-end 2027-05-30 --format json
node dist/cli/index.js capabilities --format json
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --brand Apple --serial C02XXX --warranty-end 2027-05-30 --format rich-json
node dist/cli/index.js chat parse "記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房" --format rich-json
node dist/cli/index.js chat confirm --draft-json '{"kind":"draft","draft":{"name":"MacBook Pro","category":"laptop","needsConfirmation":true,"sourceText":"...","commandArgs":[]}}' --format rich-json
node dist/cli/index.js chat items "搵 MacBook" --format rich-json
node dist/cli/index.js chat mutate "edit MacBook 改做 location: 書房" --dry-run --artifact-dir /tmp/inventory-runs --format rich-json
node dist/cli/index.js item list --format json
node dist/cli/index.js item detail itm_123 --format json
node dist/cli/index.js item edit itm_123 --location Study --dry-run --format json
node dist/cli/index.js item delete itm_123 --dry-run --format json
node dist/cli/index.js item restore itm_123 --dry-run --format json
node dist/cli/index.js warranty check --warranty-end 2027-05-30 --format json
node dist/cli/index.js document attach --item itm_123 --path /path/to/receipt.jpg --kind receipt --dry-run --format json
node dist/cli/index.js document list --item itm_123 --format json
node dist/cli/index.js document ingest-draft --item itm_123 --path /path/to/warranty.pdf --kind warranty --format json
node dist/cli/index.js service-event add --item itm_123 --kind maintenance --title "Clean keyboard" --due-on 2026-06-05 --dry-run --format json
node dist/cli/index.js service-event list --item itm_123 --format json
node dist/cli/index.js reminder due --within 45d --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --dry-run --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --format telegram
./scripts/preflight.sh
```

## Rich Message Delivery

- `richMessage.schemaVersion` is currently `1` and `channel` is `telegram`.
- For direct Telegram replies, prefer `richMessage.fallbackText` as the message body. It may contain Telegram-safe HTML such as `<b>...</b>`; pass it through unchanged except for concise translation/localization. Preserve stable IDs from `data` if the fallback does not include them.
- If using OpenClaw `message.send`, pass `richMessage.fallbackText` as `message` and `richMessage.presentation` as `presentation` when the surface supports rich output. Telegram currently uses the text body for formatting and mainly renders `presentation` for inline controls. `richMessage.blocks` remains a legacy adapter hint. Do not expose raw JSON to the user unless debugging.
- Keep the reply in Traditional Chinese/Cantonese even if the CLI fallback text is English.

Reply in Traditional Chinese/Cantonese by default. Keep outputs short, but always include stable IDs for future edits, deletes, restores, document attachment, service events, and evidence exports.
