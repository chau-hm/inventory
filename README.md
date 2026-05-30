# Inventory Control

Agent-native personal inventory control app. The MVP is a TypeScript CLI intended for OpenClaw / Telegram workflows, with deterministic core logic for warranty-heavy owned items.

## Direction

- Track personal physical items with warranty, receipt, serial number, location, service history, reminders, and evidence export.
- Keep data local-first. Runtime data and attachments stay outside git.
- Use chat/agent as the primary user surface, but keep the CLI non-interactive and stable.
- Keep domain logic independent from OCR, LLM, Telegram, and provider adapters.

## Current Stage

Stage 0 skeleton is intentionally small:

- TypeScript project setup.
- Commander CLI shell.
- Vitest test setup.
- Project rules in `AGENTS.md`.

Persistence, item CRUD, warranty logic, document ingest, and reminders are added in later spec slices.

## Commands

```bash
npm install
npm run build
npm test
node dist/cli/index.js health
node dist/cli/index.js health --format json
node dist/cli/index.js warranty check --warranty-end 2026-12-31 --as-of 2026-05-30
node dist/cli/index.js warranty check --purchase-date 2026-05-30 --warranty-months 24 --as-of 2026-05-30 --format json
```

## Planned CLI Shape

```bash
inventory item add "MacBook Pro" --category laptop --brand Apple --serial C02XXX
inventory warranty check --warranty-end 2029-05-30
inventory reminder due --within 45d
inventory document attach itm_123 ./receipt.jpg --kind receipt
inventory export evidence-pack itm_123 --output ./macbook-evidence.zip
```

## Docs

Vault planning docs live in:

```text
/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory
```
