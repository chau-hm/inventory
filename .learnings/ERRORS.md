# Errors

## [ERR-20260530-001] json_file_item_repository_empty_store

**Logged**: 2026-05-30T23:27:00+08:00
**Priority**: medium
**Status**: fixed
**Area**: backend

### Summary
JSON-file item repository treated an existing empty store file as invalid JSON instead of an empty item store.

### Error
```
ITEM_COMMAND_FAILED: Unexpected end of JSON input
```

### Context
- Command attempted: `node dist/cli/index.js item add --store "$STORE" ...` where `$STORE` was created by `mktemp`.
- Empty file existed before first write, so adapter read it and attempted `JSON.parse("")`.

### Suggested Fix
Treat empty/whitespace-only store files as `{ items: [] }`; add adapter test coverage for this case.

### Metadata
- Reproducible: yes
- Related Files: src/adapters/json-file-item-repository.ts

---
