---
name: hagi
description: Use when the user wants to run, verify, or update the HagiCode CLI against the Hagi API. Keep package-first command guidance primary, then follow the proposal flow, local development, and validation references as needed.
---

# Hagi

Use this skill when the user asks to:

- run or verify the `hagi` CLI
- explain or execute `project`, `proposal`, `chat`, or `autotask` commands
- inspect CLI flags, environment variables, exit codes, or JSON automation behavior
- validate proposal-session flows against a backend API
- modify or debug the CLI implementation in `repos/cli`

## Core rules

- Prefer `npx @hagicode/cli ...` for normal usage and package-level verification.
- Use `hagi ...` only when `@hagicode/cli` is already installed and on `PATH`.
- Run repository-local install, build, and test commands with the working directory set to `repos/cli`.
- Never run `npm install`, `npm run`, or other build commands at the monorepo root.
- Prioritize API invocation guidance over codebase tours unless the user explicitly wants implementation work.

## Choose the workflow

1. Published package usage -> read [`references/cli-usage.md`](references/cli-usage.md)
2. Explicit proposal lifecycle work -> read [`references/proposal-flow.md`](references/proposal-flow.md)
3. Source-tree development in `repos/cli` -> read [`references/local-development.md`](references/local-development.md)
4. Post-change validation -> read [`references/validation.md`](references/validation.md)

## Runtime configuration

Shared runtime flags:

- `--base-url <url>`
- `--token <token>`
- `--lang <lang>`
- `--json`

Equivalent environment variables:

- `HAGI_API_BASE_URL`
- `HAGI_API_TOKEN`
- `HAGI_API_LANG`

Flags override environment variables.

## Command surface

The current top-level command families are:

- `project`
- `proposal`
- `chat`
- `autotask`

## Source of truth

- Canonical writable skill source: `repos/cli/skills/hagi/`
- Historical reference only: `repos/skills/hagi/`

## References

- [`references/cli-usage.md`](references/cli-usage.md) - package-first installation, quick start, runtime flags, and exit codes
- [`references/proposal-flow.md`](references/proposal-flow.md) - explicit proposal lifecycle sequence and command examples
- [`references/local-development.md`](references/local-development.md) - maintainer-only development, build, and repository internals
- [`references/validation.md`](references/validation.md) - targeted verification after documentation or code changes
