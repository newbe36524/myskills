<!-- Managed by skillsbase CLI. -->

# Maintainer Workflow

The maintainer flow stays template-derived: `npm ci -> npm install --global @hagicode/skillsbase -> npm run sync -> npm test -> npm run sync:check`.

## Ownership Audit

| Classification | Paths | Maintenance rule |
| --- | --- | --- |
| Baseline-owned | `package.json`, `sources.yaml`, `README.md`, `docs/maintainer-workflow.md`, `skills/README.md`, `.github/workflows/skills-sync.yml`, `.github/actions/skillsbase-sync/action.yml` | Keep the template placement and responsibility split stable. |
| Extension-owned | repository-specific `sources.yaml` blocks, `skills/<name>/`, `skills/system-<name>/`, `tests/repository-contract.test.mjs` | Preserve only the documented `myskills` source inventory and naming differences. |
| Obsolete | `scripts/sync-skills.mjs`, `scripts/validate-skills.mjs`, other ad hoc root sync helpers | Do not reintroduce replaced structure files. |

## Lifecycle

1. `npm ci`
2. `npm install --global @hagicode/skillsbase`
3. `npm run sync`
4. `npm test`
5. `npm run sync:check`
6. `skillsbase github_action --kind all --repo .` only when the managed GitHub assets must be regenerated

## Manifest Contract

- `sources.yaml` is the single source of truth.
- The baseline manifest keys remain explicit: `version`, `skillsRoot`, `metadataFile`, `managedBy`, `remoteRepository`, `staleCleanup`, `skillsCliVersion`, and `installAgent`.
- Every source block uses `kind: github-repository`, so `skillsbase sync` installs through `npx skills add <owner/repo@skill>`.
- Community skills preserve their original install names.
- OpenAI-hosted skills publish with the `system-` prefix.
- `skills/**` is managed output only.
- Each `.skill-source.json` records provenance, install metadata, and the managed file list used for drift detection.

## Naming Rules

- GitHub-sourced community skills keep their original names: `skills/<name>/`
- OpenAI-hosted skills keep the `system-` prefix: `skills/system-<name>/`
- The hosted repository identity remains `newbe36524/myskills`

## Validation

- `npm run sync` rebuilds the managed output from the declared GitHub repositories.
- `npm test` validates template-derived structure, GitHub source contracts, metadata invariants, and `npx skills add . --list` compatibility.
- `npm run sync:check` validates drift without writing files.
- The GitHub workflow and composite action now call `skillsbase` directly, matching the template entrypoint shape.

## Non-Interactive Flow

CI and other non-interactive environments should run:

```bash
npm ci
npm install --global @hagicode/skillsbase
npm test
npm run sync:check
```

## GitHub Maintenance Path

Local CLI commands remain the primary maintainer path.

Use `.github/workflows/skills-manage.yml` only when a maintainer needs a GitHub UI entrypoint for non-interactive repository maintenance.

- `operation` chooses `add`, `remove`, or `sync`
- `skill-name` is required for `add` and `remove`
- `source` is optional and maps to `--source`
- `allow-missing-sources` maps to `--allow-missing-sources`
- `run-tests` controls the post-operation `npm test`
- The workflow does not commit, push, or open pull requests

## Notes

- Do not edit `skills/**` managed files by hand; update `sources.yaml` to point at the correct GitHub repository source, then rerun `npm run sync`.
- Do not reintroduce obsolete root-level sync helper scripts or the removed repo-local wrapper.
- The public install surface stays stable: `npx skills add newbe36524/myskills -g --all`
