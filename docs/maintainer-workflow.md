# Maintainer workflow

## Purpose

`newbe36524/myskills` is maintained as a self-hosted aggregate repository. The committed `skills/` tree is the install surface for both local validation and remote installs.

## Source policy

- First-party source root: `/home/newbe36524/.agents/skills`
- Mirrored system source root: `/home/newbe36524/.codex/skills/.system`
- Source-of-truth manifest: `sources.yaml`
- Managed metadata file: `.skill-source.json`

## Naming rules

- First-party skills publish as `skills/<name>/`
- Mirrored system skills publish as `skills/system-<name>/`
- Collision handling is deterministic: mirrored system skills always keep the `system-` prefix, so first-party names stay canonical

## Refresh workflow

From the repository root:

```bash
node scripts/sync-skills.mjs
node scripts/validate-skills.mjs
```

If you need a non-destructive drift check first:

```bash
node scripts/sync-skills.mjs --check
```

## Validation workflow

- Local discovery check: `npx skills add . --list`
- Full contract check: `node scripts/validate-skills.mjs`
- Canonical remote install path: `npx skills add newbe36524/myskills -g --all`

## Conflict handling

- If a first-party skill and a mirrored system skill share a name, the first-party skill keeps the short name and the mirrored copy becomes `system-<name>`
- If `sources.yaml` adds a target-name collision outside that rule, `node scripts/sync-skills.mjs` fails fast
- Stale managed directories are removed only when `.skill-source.json` marks them as script-managed output

## CI note

Hosted CI usually cannot access the machine-local source roots under `/home/newbe36524`. That is expected. CI should validate the committed repository output, while local or self-hosted runs perform the actual sync from those roots.
