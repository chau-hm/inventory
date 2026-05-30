# AGENTS.md - Inventory Control

## Project Goal

Build an agent-native personal inventory control app where chat is the primary UI and the MVP runs as a CLI-first tool inside OpenClaw or a similar local agent environment. The distinctive feature is warranty-aware records for owned items: receipts, serial numbers, warranty dates, locations, service history, reminders, and evidence export.

## Product Rules

- MVP is personal inventory only. Do not add company asset assignment, approval flows, role permissions, or multi-user ownership unless the spec is updated.
- Store inventory data and attachments locally by default. SQLite should hold metadata and file references, not document binaries.
- Keep raw documents/OCR extraction separate from confirmed item fields.
- Warranty state must be deterministic and testable without OCR, LLM, Telegram, or live provider calls.
- Reminder v1 returns a deterministic due list. Cron/Telegram proactive delivery is a later adapter layer.
- OCR v1 defines provider interfaces and draft/confirmation contracts first. Use fake adapters in tests until Apple Vision implementation is explicitly scoped.
- Deletion defaults to soft delete for items, documents, and service events.
- Ambiguous edit/delete/restore requests must return candidates and must not mutate state.

## Engineering Rules

- This repo follows SDD + TDD. Write or update the relevant spec slice before implementation, then write tests before or alongside code.
- Do not start coding from a loose prompt. Convert the request into acceptance criteria first.
- Keep domain logic separate from CLI, agent, OCR, filesystem, and future OpenClaw/Telegram adapters.
- Use stable IDs for saved entities so CLI/chat list/search/edit/delete commands can target them.
- Human-readable output should be concise. JSON output must be stable for agent/tool integration.
- Command mode must be non-interactive: no hidden prompts.
- If behavior is ambiguous, update the vault spec or stop and report the missing decision.

## Suggested Module Boundaries

- `src/domain/`: pure warranty, reminder, lifecycle, validation rules.
- `src/application/`: use cases coordinating domain and repositories.
- `src/persistence/`: SQLite/Drizzle schema and repository implementations.
- `src/cli/`: Commander program, output formatting, exit codes.
- `src/agent/`: draft schemas and confirmation payloads.
- `src/adapters/`: OCR providers, local attachment storage, export generation, OpenClaw glue.

## SDD + TDD Workflow

Every implementation slice must follow:

1. Spec: behavior, data impact, edge cases, and acceptance criteria.
2. Test: failing or updated tests that encode the acceptance criteria.
3. Implement: smallest code change that passes the tests.
4. Refactor: only after tests pass.
5. Document: update TODO/spec notes when behavior changes.

Definition of done:

- Spec slice exists.
- Tests cover the slice.
- Tests pass locally.
- Domain behavior is deterministic and not dependent on LLM/OCR/provider output.
- Vault docs/TODO/Decisions are updated when scope or behavior changes.

## Project Docs

- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/PRD.md`
- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/Architecture.md`
- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/SDD_TDD_Workflow.md`
- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/TODO.md`
- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/Decisions.md`
- `/Users/openclaw/Desktop/VirtualBuddyShared/Vault/side projects/inventory/Research.md`
