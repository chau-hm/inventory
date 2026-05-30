# Spec Slice: Item JSON CRUD

## User-Facing Behavior

The CLI can save, list, view, edit, soft-delete, and restore item records using a local JSON file. This is an interim persistence slice before SQLite/Drizzle. It establishes the command behavior and safe mutation rules that later storage adapters must preserve.

## Inputs

- Store path: optional `--store <path>`; defaults to a local runtime path in later deployment.
- Item create fields from the item domain draft.
- Target for detail/edit/delete/restore: exact item ID or natural-language query.
- List status filter: `active`, `archived`, `sold`, `disposed`, `lost`, `deleted`, or `all`.

## Outputs

- Human-readable output is concise and includes stable item IDs.
- JSON output returns `{ ok: true, item }`, `{ ok: true, items }`, or `{ ok: false, error }`.
- All saved items include stable `id`, `createdAt`, and `updatedAt`.

## State Changes

- `item add` creates a validated item with an `itm_` ID and `active` status by default.
- `item list` does not mutate.
- `item detail` does not mutate.
- `item edit` updates only supplied fields, keeps the same ID, and refreshes `updatedAt`.
- `item delete` performs soft delete by setting `status = deleted`, `deletedAt`, and `updatedAt`.
- `item restore` changes `status` from `deleted` to `active`, clears `deletedAt`, and refreshes `updatedAt`.

## Target Resolution Rules

- Exact ID targets are preferred and can mutate after validation.
- Text/query targets search item name, category, brand, model, serial number, location, owner, merchant, and notes.
- Edit/delete search only non-deleted items unless exact ID is supplied.
- Restore search only deleted items unless exact ID is supplied.
- Zero matches returns `ITEM_NOT_FOUND` and does not mutate.
- Multiple matches returns `AMBIGUOUS_ITEM` with candidate IDs and does not mutate.

## Acceptance Criteria

- Add/list/detail can round-trip a saved item through JSON storage.
- Edit updates supplied fields and preserves ID/createdAt.
- Delete is soft delete and hides the item from normal list.
- Restore reactivates a deleted item.
- Ambiguous text target returns candidates and does not mutate.
- JSON output remains stable for agent integration.

