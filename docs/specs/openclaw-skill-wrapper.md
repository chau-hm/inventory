# OpenClaw Skill Wrapper

## Scope

Expose the inventory CLI as a local OpenClaw skill so Telegram/OpenClaw requests can be translated into deterministic CLI commands.

## Skill Location

The wrapper lives outside the repo:

```text
/Users/openclaw/.openclaw/workspace/skills/inventory/SKILL.md
```

## Contract

- Use the built CLI from this repo: `node dist/cli/index.js ...`.
- Run from `/Users/openclaw/Desktop/VirtualBuddyShared/VirtualBuddyShared/repo/inventory`.
- Prefer JSON output for internal reads and concise Traditional Chinese/Cantonese summaries for users.
- Preserve stable IDs in responses because later edit/delete/restore flows depend on them.
- Do not mutate ambiguous targets. List candidates and ask one concise clarification.
- Treat `document ingest-draft` as an OCR draft contract only; Apple Vision is not wired in this slice.
- Evidence pack exports remain local folders and report the output/manifest paths.

## Acceptance

- Skill has valid YAML frontmatter.
- Skill documents common item, document, service-event, reminder, export, and preflight commands.
- Vault TODO Phase 6 marks the wrapper complete.
