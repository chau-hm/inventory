# Inventory Control

Agent-native personal inventory control app. The MVP is a TypeScript CLI intended for OpenClaw / Telegram workflows, with deterministic core logic for warranty-heavy owned items.

## Direction

- Track personal physical items with warranty, receipt, serial number, location, service history, reminders, and evidence export.
- Keep data local-first. Runtime data and attachments stay outside git.
- Use chat/agent as the primary user surface, but keep the CLI non-interactive and stable.
- Keep domain logic independent from OCR, LLM, Telegram, and provider adapters.

## Current Stage

The current implementation has the first item-management path in place:

- TypeScript project setup.
- Commander CLI shell.
- Vitest test setup.
- Project rules in `AGENTS.md`.
- Warranty state calculation.
- Item validation and item CRUD.
- SQLite item repository, with JSON-file storage still available as an interim fallback.
- Local document attachment metadata and OCR ingest draft contract.
- Service timeline events and deterministic due reminder output.
- Evidence pack export and an OpenClaw skill wrapper for Telegram/OpenClaw workflows.

Apple Vision OCR implementation and push notifications are added in later spec slices.

## Commands

```bash
npm install
npm run build
npm test
./scripts/preflight.sh
node dist/cli/index.js health
node dist/cli/index.js health --format json
node dist/cli/index.js item validate --name "MacBook Pro" --category laptop
node dist/cli/index.js item validate --name "AirPods Pro" --category audio --purchase-price-minor 189900 --currency HKD --format json
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --store /tmp/inventory-items.json
node dist/cli/index.js item list --store /tmp/inventory-items.json
node dist/cli/index.js item detail "MacBook" --store /tmp/inventory-items.json
node dist/cli/index.js item edit "MacBook" --location Study --store /tmp/inventory-items.json
node dist/cli/index.js item delete "MacBook" --store /tmp/inventory-items.json
node dist/cli/index.js item restore "MacBook" --store /tmp/inventory-items.json
node dist/cli/index.js item add --name "Nintendo Switch" --category console --db /tmp/inventory.sqlite
node dist/cli/index.js item list --db /tmp/inventory.sqlite --format json
node dist/cli/index.js document attach --item itm_123 --path ./receipt.jpg --kind receipt --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments
node dist/cli/index.js document list --item itm_123 --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments
node dist/cli/index.js document ingest-draft --item itm_123 --path ./warranty.pdf --kind warranty --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --format json
node dist/cli/index.js service-event add --item itm_123 --kind maintenance --title "Clean keyboard" --due-on 2026-06-05 --events-store /tmp/inventory-events.json
node dist/cli/index.js service-event list --item itm_123 --events-store /tmp/inventory-events.json --format json
node dist/cli/index.js reminder due --store /tmp/inventory-items.json --events-store /tmp/inventory-events.json --as-of 2026-05-30 --within 45d --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --store /tmp/inventory-items.json --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --events-store /tmp/inventory-events.json --format telegram
node dist/cli/index.js warranty check --warranty-end 2026-12-31 --as-of 2026-05-30
node dist/cli/index.js warranty check --purchase-date 2026-05-30 --warranty-months 24 --as-of 2026-05-30 --format json
```

## OpenClaw Skill

The local OpenClaw wrapper lives at:

```text
/Users/openclaw/.openclaw/workspace/skills/inventory/SKILL.md
```

It translates `/inventory` or natural-language inventory requests into this repo's CLI, prefers JSON for internal reads, and keeps saved IDs visible for future edit/delete/restore flows.

## Planned CLI Shape

```bash
inventory item add "MacBook Pro" --category laptop --brand Apple --serial C02XXX
inventory item validate --name "MacBook Pro" --category laptop
inventory item add --name "MacBook Pro" --category laptop
inventory item list
inventory item detail itm_123
inventory item edit itm_123 --location Study
inventory item delete itm_123
inventory item restore itm_123
inventory warranty check --warranty-end 2029-05-30
inventory reminder due --within 45d
inventory service-event add --item itm_123 --kind maintenance --title "Clean keyboard" --due-on 2029-04-15
inventory document attach --item itm_123 --path ./receipt.jpg --kind receipt
inventory document ingest-draft --item itm_123 --path ./receipt.jpg --kind receipt
inventory export evidence-pack --item itm_123 --output ./macbook-evidence
```

## Docs

Vault planning docs live in:

```text
/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory
```
