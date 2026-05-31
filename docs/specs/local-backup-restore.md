# Local Backup And Restore Notes

## Goal

Document the local files that must be copied to recover inventory data on this host before adding automated backup commands.

## Data To Back Up

Default runtime data lives outside git under:

```text
~/.inventory-control/
  inventory.sqlite
  items.json
  documents.json
  service-events.json
  attachments/
  exports/
```

Back up all files in that directory together. The SQLite database stores item metadata when `--db` is used. JSON stores remain valid for fallback or test-like local runs. Attachment files are referenced by document metadata and must be kept with `documents.json` or the SQLite metadata that points at them.

## Restore Procedure

1. Stop any running command or agent job that may write inventory data.
2. Move the broken `~/.inventory-control/` directory aside instead of deleting it.
3. Restore the whole backed-up `~/.inventory-control/` directory, preserving `attachments/` paths.
4. Run `node dist/cli/index.js health`.
5. Run `node dist/cli/index.js item list --db ~/.inventory-control/inventory.sqlite --format json` if SQLite is in use.
6. Run `node dist/cli/index.js document list --format json` to confirm document metadata is readable.

## Acceptance Criteria

- Docs identify SQLite, JSON stores, attachments, and exports.
- Docs warn that metadata and attachments must be backed up together.
- Restore checks use existing non-interactive CLI commands.
