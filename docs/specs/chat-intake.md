# Chat Intake

## Goal

Allow OpenClaw or Telegram users to describe a new inventory item in natural language, while keeping saved data changes deterministic and confirmable.

## Behavior

- `chat parse <text>` parses natural-language item text into a non-mutating draft.
- `chat confirm --draft-json <json>` confirms a parsed item draft and saves it through the normal item service.
- `chat items <text>` parses list/search requests and returns saved items without mutation.
- `chat mutate <text>` parses edit/delete/restore requests and mutates only when the target resolves to one item.
- Drafts include normalized item fields plus equivalent `item add` command arguments.
- Drafts always set `needsConfirmation: true`.
- Confirming a draft must accept either the full `chat parse` result or the inner draft object.
- If the parser cannot identify a usable item name or category, it returns `needs_clarification` and does not save anything.
- Ambiguous mutation targets return candidates and leave saved data unchanged.
- The parser is deterministic and rule-based. It does not call an LLM, OCR provider, or remote service.

## Supported V1 Fields

- Name
- Category
- Brand
- Model
- Serial number
- Location
- Owner
- Purchase date
- Purchase price and currency
- Merchant
- Warranty end
- Warranty months
- Notes

## Out Of Scope

- Persisting multi-turn draft state.
- Automatically saving parsed drafts.
- LLM-backed extraction.
- Complex multi-field corrections without explicit field markers.

## Acceptance Criteria

- Cantonese item notes such as `記低 MacBook Pro，2026-05-30 買，AppleCare 到 2029-05-30，放書房` produce an `item add` draft.
- `chat confirm --draft-json` saves a parsed draft and returns the stable item ID.
- Missing category returns clarification instead of guessing `general`.
- Saved-item list/search requests are read-only.
- Saved-item edit/delete/restore requests use the same ambiguity protection as direct item commands.
- CLI JSON output remains stable for agent callers.
