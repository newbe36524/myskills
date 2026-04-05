# Local Development

This document is maintainer-only.
Use it when you are editing or validating the CLI source tree inside `repos/cli`.
Normal users should stay on the published package path.

## Working directory rule

Always change into `repos/cli` before running install, build, or test commands.
Do not run npm commands at the monorepo root.

```bash
cd repos/cli
```

## Development modes

### Source-level development

Use the TypeScript entrypoint directly while changing behavior:

```bash
cd repos/cli
npm run dev -- proposal list --json
npm run dev -- chat list --json
```

### Release-style verification

Build the local distribution and run the bundled CLI:

```bash
cd repos/cli
npm run build
node ./dist/cli.js --help
node ./dist/cli.js proposal --help
```

## Repository map

Inspect these areas when implementation details matter:

- `src/commands/` - command registration, flags, and request shaping
- `src/runtime/` - API runtime, shared context, and error handling
- `src/formatters/` - human-readable and JSON output formatting
- `buildTools/` - OpenAPI client generation scripts
- `scripts/verify-package.mjs` - publish-surface verification

## API client generation

The CLI owns its OpenAPI generation configuration.
Use these commands when the backend schema changes:

```bash
cd repos/cli
npm run generate:api
npm run generate:api:once
```

Default Swagger source:

- `http://127.0.0.1:35168/swagger/v1/swagger.json`

## Release automation

GitHub workflows under `.github/workflows/` handle release drafting and npm publishing.
For a stable release dry run, use:

```bash
cd repos/cli
version="$(npm run --silent publish:verify-release -- v0.1.0)"
npm version --no-git-tag-version "$version"
npm run build
npm run typecheck
npm test
npm run pack:check
```
