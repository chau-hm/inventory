# Inventory Control

Agent-native personal inventory control app. The MVP is a TypeScript CLI intended for OpenClaw / Telegram workflows, with deterministic core logic for warranty-heavy owned items.

## Purpose

- Track personal physical items with warranty, receipt, serial number, location, service history, reminders, and evidence export.
- Keep data local-first. Runtime data and attachments stay outside git.
- Use chat/agent as the primary user surface, but keep the CLI non-interactive and stable.
- Keep domain logic independent from OCR, LLM, Telegram, and provider adapters.

## Features

- Item validation and CRUD with soft delete/restore.
- Warranty state calculation from warranty end dates or purchase date plus warranty duration.
- SQLite item storage, with JSON-file storage still available for temporary/test runs.
- Local receipt/warranty document attachments.
- OCR ingest draft contract. Apple Vision OCR integration is planned later.
- Service timeline events and deterministic due reminder output.
- Evidence-pack export for warranty claims or resale handoff.
- Agent-first CLI contracts: machine-readable capabilities, mutation dry-runs, typed JSON errors, explicit scope/side-effect metadata, and optional run receipts via `--artifact-dir`.
- OpenClaw skill wrapper for Telegram `/inventory` and natural-language chat workflows.

## Telegram Slash Command Examples

Use `/inventory` in Telegram or any OpenClaw chat surface. Write the request naturally; the agent translates it into deterministic local CLI calls, confirms risky or ambiguous changes, and replies with stable IDs.

General behavior:

- Exact IDs such as `itm_...`, `doc_...`, and `sev_...` can be acted on directly.
- Fuzzy targets such as "MacBook" or "IronWolf" are resolved first. If more than one item matches, the app must ask which ID to use before mutating.
- Add-item drafts are non-mutating until confirmed, unless the request explicitly says to save or入庫 and the parsed draft is unambiguous.
- Receipt/warranty OCR ingest is currently a draft contract; real Apple Vision OCR is planned for a later slice.

### Item Intake

```text
/inventory 記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房
/inventory 幫我入庫 Seagate IronWolf Pro 8TB HDD，型號 ST8000NT001，S/N WWZBF1AD，2026-05-30 喺 SE Computer 買，HKD 2499，保養 5 年
/inventory 記低新買嗰個 Apple 嘢，放客廳
```

Expected behavior:

- The first example returns an item draft and waits for confirmation.
- The second example parses and saves if unambiguous, then replies with the new `itm_...` ID.
- The third example asks for missing item name/category instead of guessing.

### Item Lookup

```text
/inventory 睇下而家 inventory 有咩
/inventory 搵 IronWolf
/inventory 睇 itm_18917d3d5560 詳情
```

Expected behavior:

- List/search requests are read-only.
- Detail requests include important warranty, serial, location, merchant, and document/service summary fields when available.

### Item Mutation

```text
/inventory 將 IronWolf 8TB 位置改做 NAS Bay 2，notes 加「用嚟做 Time Machine」
/inventory 將 MacBook 改做放公司
/inventory 刪咗 itm_123456789abc
/inventory 還原頭先刪咗嗰隻 IronWolf
```

Expected behavior:

- Exact ID delete/restore/edit can run directly.
- Fuzzy edit/delete/restore must only mutate if one saved item resolves.
- Ambiguous targets reply with candidates and ask for the item ID.
- Delete is soft delete; reply with the deleted item ID so it can be restored.

### Validation And Warranty

```text
/inventory 幫我睇下呢個 item 資料夠唔夠：name AirPods Pro，category audio，HKD 1899，保養到 2027-06-01
/inventory 幫我計 2026-05-30 買、保養 24 個月，到今日仲有冇保？
```

Expected behavior:

- Validation checks a draft without saving.
- Warranty checks return the calculated warranty state and end date.

### Documents

```text
/inventory 呢張係 itm_18917d3d5560 嘅單，幫我掛上去
/inventory 呢張係 IronWolf 張保養紙
/inventory 睇下 IronWolf 有咩文件
/inventory 刪咗 doc_abcd1234 呢份文件
/inventory 試下由呢張保養紙抽資料，先出 draft
```

Expected behavior:

- Attached Telegram files should be saved as local inventory attachments and linked to `doc_...`.
- If the item target is fuzzy, resolve the item first.
- Document list/delete replies include document IDs.
- OCR ingest creates a draft and clearly states that the current provider is still the noop draft provider.

### Service Events And Reminders

```text
/inventory 幫 IronWolf 加一條 maintenance：2026-06-05 檢查 SMART，due 2026-06-05
/inventory 睇 IronWolf 維修/保養 timeline
/inventory 刪咗 sev_abc123 呢條 maintenance
/inventory 未來 45 日有咩保養或者維修要跟？
```

Expected behavior:

- Service-event saves return `sev_...` IDs.
- Timeline/list operations are read-only.
- Reminder output combines due service events and warranty-related reminders.

### Evidence Export And Health

```text
/inventory 幫 IronWolf 出一份 warranty claim evidence pack
/inventory inventory app 係咪正常？
```

Expected behavior:

- Evidence exports reply with the output folder and manifest path.
- Health check confirms whether the local CLI is reachable.

## CLI Commands

These commands are the local deterministic backend used by the OpenClaw skill. Keep them non-interactive and stable so Telegram slash-command routing can safely call them.

```bash
npm install
npm run ci
npm run build
npm test
./scripts/preflight.sh
```

```bash
node dist/cli/index.js health
node dist/cli/index.js health --format json
node dist/cli/index.js capabilities --format json
node dist/cli/index.js chat parse "記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房" --format json
node dist/cli/index.js chat confirm --draft-json '{"kind":"draft","draft":{"name":"MacBook Pro","category":"laptop","needsConfirmation":true,"sourceText":"...","commandArgs":[]}}' --format json
node dist/cli/index.js chat confirm --draft-json '{"kind":"draft","draft":{"name":"MacBook Pro","category":"laptop","needsConfirmation":true,"sourceText":"...","commandArgs":[]}}' --dry-run --format json
node dist/cli/index.js chat items "搵 MacBook" --format json
node dist/cli/index.js chat mutate "edit MacBook 改做 location: 書房" --dry-run --format json
node dist/cli/index.js item validate --name "MacBook Pro" --category laptop
node dist/cli/index.js item validate --name "AirPods Pro" --category audio --purchase-price-minor 189900 --currency HKD --format json
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --store /tmp/inventory-items.json --dry-run --artifact-dir /tmp/inventory-runs --format json
node dist/cli/index.js item add --name "MacBook Pro" --category laptop --store /tmp/inventory-items.json
node dist/cli/index.js item list --store /tmp/inventory-items.json
node dist/cli/index.js item detail "MacBook" --store /tmp/inventory-items.json
node dist/cli/index.js item edit "MacBook" --location Study --store /tmp/inventory-items.json --dry-run --format json
node dist/cli/index.js item delete "MacBook" --store /tmp/inventory-items.json --dry-run --format json
node dist/cli/index.js item restore "MacBook" --store /tmp/inventory-items.json --dry-run --format json
node dist/cli/index.js item add --name "Nintendo Switch" --category console --db /tmp/inventory.sqlite
node dist/cli/index.js item list --db /tmp/inventory.sqlite --format json
node dist/cli/index.js document attach --item itm_123 --path ./receipt.jpg --kind receipt --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --dry-run --format json
node dist/cli/index.js document list --item itm_123 --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments
node dist/cli/index.js document ingest-draft --item itm_123 --path ./warranty.pdf --kind warranty --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --format json
node dist/cli/index.js service-event add --item itm_123 --kind maintenance --title "Clean keyboard" --due-on 2026-06-05 --events-store /tmp/inventory-events.json --dry-run --format json
node dist/cli/index.js service-event list --item itm_123 --events-store /tmp/inventory-events.json --format json
node dist/cli/index.js reminder due --store /tmp/inventory-items.json --events-store /tmp/inventory-events.json --as-of 2026-05-30 --within 45d --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --store /tmp/inventory-items.json --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --events-store /tmp/inventory-events.json --dry-run --artifact-dir /tmp/inventory-runs --format json
node dist/cli/index.js export evidence-pack --item itm_123 --output /tmp/macbook-evidence --store /tmp/inventory-items.json --documents-store /tmp/inventory-documents.json --attachments-dir /tmp/inventory-attachments --events-store /tmp/inventory-events.json --format telegram
node dist/cli/index.js warranty check --warranty-end 2026-12-31 --as-of 2026-05-30
node dist/cli/index.js warranty check --purchase-date 2026-05-30 --warranty-months 24 --as-of 2026-05-30 --format json
```

## Data Storage

Default local runtime paths:

- Items JSON fallback: `~/.inventory-control/items.json`
- Documents metadata: `~/.inventory-control/documents.json`
- Attachments: `~/.inventory-control/attachments`
- Service events: `~/.inventory-control/service-events.json`

SQLite item storage is enabled per command with `--db /path/to/inventory.sqlite`. Keep runtime data, attachments, and evidence exports out of git.

## OpenClaw Skill

The local OpenClaw wrapper lives at:

```text
/Users/openclaw/.openclaw/workspace/skills/inventory/SKILL.md
```

It translates `/inventory` or natural-language inventory requests into this repo's CLI, prefers JSON for internal reads, and keeps saved IDs visible for future edit/delete/restore flows.

## Docs

Spec slices live in `docs/specs/`, including chat intake in `docs/specs/chat-intake.md` and local backup and restore notes in `docs/specs/local-backup-restore.md`.

Vault planning docs live in:

```text
/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory
```
