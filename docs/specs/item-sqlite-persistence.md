# Item SQLite Persistence Slice

## Goal

Replace the temporary file-only storage path with a SQLite-backed repository that can run the existing item application service unchanged.

## Scope

- Store saved items in an `items` SQLite table.
- Preserve the current item contract and lifecycle behavior.
- Initialize the schema automatically when the repository opens a database.
- Keep the JSON-file adapter available as an interim fallback while the CLI migrates.

## Non-goals

- Drizzle migration generation.
- Attachment/document tables.
- Full text search.
- Multi-user ownership or asset assignment.

## Acceptance

- A missing SQLite database is created automatically.
- Empty databases list zero items.
- `saveAll` round-trips every currently supported item field.
- `ItemService` can add/delete/restore items using the SQLite repository.
- CLI item commands support an explicit `--db` path.

