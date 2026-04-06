# myskills

`myskills` is the template-derived `skillsbase` repository that publishes the managed install surface for `newbe36524/myskills`.

## Install

Canonical remote install:

```bash
npx skills add newbe36524/myskills -g --all
```

Local repository listing:

```bash
npx skills add . --list
```

## Template-Derived Structure

- Baseline-owned paths: `package.json`, `sources.yaml`, `README.md`, `docs/maintainer-workflow.md`, `skills/README.md`, and `.github/**`
- Extension-owned paths: the repository-specific source blocks in `sources.yaml`, `skills/<name>/`, `skills/system-<name>/`, and `tests/repository-contract.test.mjs`
- Obsolete paths: do not reintroduce ad hoc root scripts such as `scripts/sync-skills.mjs` or `scripts/validate-skills.mjs`

## Maintenance Commands

Run all maintainer commands from the repository root:

```bash
npm ci
npm install --global @hagicode/skillsbase
npm run sync
npm run sync:check
npm test
```

These commands keep the template maintenance surface. CI installs `skillsbase` globally before running the drift check.

Regenerate the managed GitHub workflow or composite action only when the automation templates change:

```bash
skillsbase github_action --kind all --repo .
```

## Repository-Specific Sources

`sources.yaml` is the single source of truth for the baseline manifest keys plus the repository-specific source blocks.

- Every managed skill syncs from an explicit GitHub repository source that can be resolved with `npx skills`.
- Community skills keep their original directory names.
- OpenAI-hosted skills are published as `system-<name>` to avoid collisions.
- `skills/` contains committed managed output only.
- Every managed skill directory includes `.skill-source.json`, which records provenance, target naming, and the managed file list.

## Validation

- `npm test` validates the committed repository contract, GitHub source declarations, and `npx skills add . --list` compatibility.
- `npm run sync` refreshes managed content from the declared GitHub repositories.
- `npm run sync:check` verifies drift without writing files.

For the full maintainer flow and the ownership audit, see `docs/maintainer-workflow.md`.
