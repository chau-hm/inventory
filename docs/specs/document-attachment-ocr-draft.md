# Document Attachment And OCR Draft Slice

## Goal

Allow an agent to attach local warranty-related files to an item and create an OCR ingest draft without mixing raw extraction with confirmed item fields.

## Scope

- Store copied attachments under a local attachments directory.
- Store document metadata in a local manifest.
- Support attach, list, and soft delete commands.
- Define an OCR provider interface and a draft output contract.
- Use a no-op OCR provider for now.

## Non-goals

- Apple Vision implementation.
- Confirming OCR fields back onto an item.
- Evidence pack export.
- Remote/cloud storage.

## Acceptance

- `document attach` copies the source file and records metadata including hash, size, and stored path.
- `document list` filters by item id and active/deleted/all status.
- `document delete` soft-deletes metadata without removing the copied file.
- `document ingest-draft` creates an attachment and returns a draft with raw OCR text separated from `extractedFields`.
- No-op OCR returns an explicit warning instead of pretending extraction succeeded.

