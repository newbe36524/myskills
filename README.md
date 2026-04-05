# myskills

`myskills` is the canonical self-hosted repository for the skills currently maintained on this machine.

## Install

Canonical remote install:

```bash
npx skills add newbe36524/myskills -g --all
```

Local repository validation:

```bash
npx skills add . --list
node scripts/validate-skills.mjs
```

## Repository contract

- `skills/` contains the installable skill directories that remote consumers and local validation both read.
- `sources.yaml` is the source-of-truth manifest for managed source roots, naming rules, and stale-cleanup policy.
- `scripts/sync-skills.mjs` refreshes managed skills from the declared local roots.
- `scripts/validate-skills.mjs` checks repository shape, provenance metadata, and `skills` CLI compatibility.
- `docs/maintainer-workflow.md` documents sync, validation, naming, and conflict handling.

## Hosted sources

- First-party skills come from `/home/newbe36524/.agents/skills` and keep their original directory names.
- Mirrored system skills come from `/home/newbe36524/.codex/skills/.system` and are published as `system-<name>` to avoid collisions.
- Every managed skill directory includes `.skill-source.json` so future refreshes and stale cleanup stay deterministic.

## Maintainer entrypoints

Refresh managed content from local roots:

```bash
node scripts/sync-skills.mjs
```

Check for drift without modifying files:

```bash
node scripts/sync-skills.mjs --check
```

Validate the committed repository output:

```bash
node scripts/validate-skills.mjs
```
