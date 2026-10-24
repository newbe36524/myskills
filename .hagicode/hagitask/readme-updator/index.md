---
public: true
multilingual: false
style: product
---

# README requirements

## Product focus

- Introduce `myskills` as a curated, ready-to-install collection of agent skills published for `newbe36524/myskills`: `documentation-writer`, `humanizer-zh`, `ui-ux-pro-max` and `vercel-react-best-practices`, each synced from its upstream GitHub repository.
- Address people who add skills to their coding agent with `npx skills add newbe36524/myskills`. Maintainers of the `skillsbase`-derived repository are secondary and covered only by a link.
- Lead with what the collection gives users and how to install it, not how the repository is maintained.

## Required content

- Open with a short product introduction and the install command `npx skills add newbe36524/myskills -g --all`, plus the local listing command `npx skills add . --list`.
- List the available skills with a one-line purpose each; the list must match `sources.yaml` and the `skills/` directory.
- Mention that skills keep their upstream names and that provenance is recorded per skill in `.skill-source.json`.
- Link to `docs/maintainer-workflow.md` for maintenance instead of copying it.

## Exclusions

- Exclude tokens, secret values, internal hosts, machine-specific paths and private links.
- Keep repository maintenance instructions out of the README: repository layout, template ownership, sync and validation commands, CI and the GitHub maintenance workflow.
- Do not list skills that are not in `sources.yaml`.
