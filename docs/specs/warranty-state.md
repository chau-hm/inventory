# Spec Slice: Warranty State Calculation

## User-Facing Behavior

Given warranty facts for an item, the app returns a deterministic warranty state for a reference date. This is the first domain slice and must not depend on persistence, OCR, LLM, Telegram, or live provider output.

The intended user value is simple: before item storage exists, the CLI can already answer "is this warranty active, expiring soon, expired, unknown, or ambiguous?"

## Inputs

- Optional item ID.
- Optional purchase date in `YYYY-MM-DD`.
- Optional direct warranty end date in `YYYY-MM-DD`.
- Optional warranty duration in whole months.
- Optional reference date in `YYYY-MM-DD`; defaults to today's date in later app layers, but tests must pass it explicitly.
- Expiring-soon window in days; default is 45.

## Output

The domain function returns:

- `state`: `active`, `expiring_soon`, `expired`, or `unknown`.
- `effectiveEndDate`: the confirmed or derived warranty end date when known and not ambiguous.
- `daysUntilEnd`: whole day difference from reference date to warranty end date when known.
- `warnings`: structured warnings for missing or conflicting facts.

The CLI returns concise text by default and stable JSON when `--format json` is used.

## State Rules

- If no direct or derived warranty end date exists, return `unknown` with `WARRANTY_FACTS_MISSING`.
- If direct warranty end exists and no derived end exists, use the direct end date.
- If direct end is missing but purchase date plus warranty months exists, derive the end date.
- If direct end and derived end both exist and disagree, return `unknown` with `WARRANTY_END_CONFLICT`; do not silently choose either value.
- Warranty end date is inclusive. If the reference date equals the end date, the item is not expired yet.
- If the effective end date is before the reference date, return `expired`.
- If the effective end date is today or within the expiring-soon window, return `expiring_soon`.
- If the effective end date is after the expiring-soon window, return `active`.

## Date Math

Warranty duration is measured in calendar months. Month-end dates clamp to the target month's last day:

- `2026-01-31 + 1 month = 2026-02-28`.
- `2024-02-29 + 12 months = 2025-02-28`.

All calculations are date-only and use UTC internally to avoid local timezone drift.

## Acceptance Criteria

- Direct active warranty returns `active`.
- Direct expiring-soon warranty returns `expiring_soon`.
- Direct expired warranty returns `expired`.
- Missing direct end can derive end date from purchase date plus warranty months.
- Missing warranty facts returns `unknown`.
- Conflicting direct and derived end dates returns `unknown` and does not choose either end date.
- Leap day and month-end duration behavior is deterministic.
- CLI supports `inventory warranty check --warranty-end YYYY-MM-DD --as-of YYYY-MM-DD`.
- CLI supports JSON output for agent integration.

