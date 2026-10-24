# myskills

[![last commit](https://img.shields.io/github/last-commit/newbe36524/myskills)](https://github.com/newbe36524/myskills/commits/main)

`myskills` is a curated, ready-to-install collection of agent skills for your coding agent. Each skill is synced from its upstream GitHub repository and published as `newbe36524/myskills`.

## Install

Canonical remote install:

```bash
npx skills add newbe36524/myskills -g --all
```

Local repository listing:

```bash
npx skills add . --list
```

## Available skills

| Skill | Purpose |
| --- | --- |
| `documentation-writer` | Diátaxis documentation expert for writing high-quality software documentation. |
| `humanizer-zh` | Removes AI-generated traces from Chinese text so it reads more naturally. |
| `ui-ux-pro-max` | UI/UX design intelligence for web and mobile: styles, color palettes, font pairings and UX guidelines. |
| `vercel-react-best-practices` | React and Next.js performance optimization guidelines from Vercel Engineering. |

Skills keep their upstream names. Where each skill comes from is recorded per skill in its `.skill-source.json` file.

## Maintainers

For how this repository is maintained, see [`docs/maintainer-workflow.md`](docs/maintainer-workflow.md).
