# myskills

`myskills` is the canonical self-hosted repository for the skills currently maintained on this machine.

## Install

Canonical remote install:

```bash
npx skills add newbe36524/myskills -g --all
```

Local repository listing:

```bash
npx skills add . --list
```

## Maintainer lifecycle

Use the repo-local `skillsbase` runtime:

```bash
npm ci
npm run sync
npm run sync:check
npm test
node ./bin/skillsbase.mjs github_action --kind all
```

`sources.yaml` is the single source of truth for managed source roots, naming rules, CLI compatibility, and stale cleanup. `skills/` contains only committed managed output.

## Hosted sources

- First-party skills come from `/home/newbe36524/.agents/skills` and keep their original directory names.
- Mirrored system skills come from `/home/newbe36524/.codex/skills/.system` and are published as `system-<name>` to avoid collisions.
- Every managed skill directory includes `.skill-source.json` so future refreshes and stale cleanup stay deterministic.

## Validation lanes

- `npm test` validates the committed repository contract and `npx skills add . --list` compatibility without requiring local source roots.
- `npm run sync` refreshes managed content from local source roots.
- `npm run sync:check` verifies drift locally.
- `node ./bin/skillsbase.mjs sync --check` auto-adds `--allow-missing-sources` on GitHub-hosted Actions so workflow validation stays deterministic.
