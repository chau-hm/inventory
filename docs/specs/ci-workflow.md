# CI Workflow

## Goal

Keep local preflight and GitHub CI aligned so every change runs the same build, typecheck, and test checks.

## Commands

Local CI entrypoint:

```bash
npm run ci
```

The preflight script delegates to the same command:

```bash
./scripts/preflight.sh
```

## GitHub Actions

Workflow path:

```text
.github/workflows/ci.yml
```

The workflow runs on pushes to `main` or `master`, pull requests, and manual dispatch. It installs dependencies with `npm ci` on Node.js 24, then runs `npm run ci`.

## Acceptance Criteria

- Local and GitHub checks share one npm script.
- CI runs build, typecheck, and tests.
- CI has read-only repository permissions.
