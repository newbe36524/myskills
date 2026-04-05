# CLI Usage

Use the published package contract first.
The repository exists to build and maintain `@hagicode/cli`, but normal command execution should start from the package surface rather than the source tree.

## Installation paths

### Zero-install

```bash
npx @hagicode/cli --help
npx @hagicode/cli project list --json
```

### Project-local install

```bash
npm install @hagicode/cli
npx @hagicode/cli proposal list --json
```

### Optional global install

```bash
npm install -g @hagicode/cli
hagi --help
```

## Quick start

When `@hagicode/cli` is already available on `PATH`, these examples work as `hagi ...`.
For one-off execution, replace `hagi` with `npx @hagicode/cli`.

```bash
hagi --help
hagi project list --json
hagi proposal list --json
hagi chat list --json
hagi autotask create --title "Auto commit" --project-id <project-id> --prompt-id auto-compose-commit.en-US
```

## Shared runtime flags

Every command family supports the same runtime flags:

- `--base-url <url>`
- `--token <token>`
- `--lang <lang>`
- `--json`

Example:

```bash
hagi --base-url https://api.example.com --token "$HAGI_TOKEN" project list --json
```

## Environment variables

The CLI resolves runtime settings centrally before every command.
Explicit flags always override environment variables.

| Variable | Purpose |
| --- | --- |
| `HAGI_API_BASE_URL` | Backend base URL. Defaults to `http://127.0.0.1:35168` when unset. |
| `HAGI_API_TOKEN` | Bearer token attached as `Authorization: Bearer <token>`. |
| `HAGI_API_LANG` | Shared `Accept-Language` header value. |

## Command overview

```text
hagi
|-- project   list | create | update | delete
|-- proposal  list | create | generate-name | optimize-description | generate | annotate | execute | archive | status | complete | send
|-- chat      list | create | archive | delete | send
`-- autotask  create | send
```

## Exit codes

Stable non-zero exits used by the CLI:

| Exit code | Meaning |
| --- | --- |
| `2` | CLI usage or validation failure |
| `20` | HTTP 400 |
| `21` | HTTP 401 |
| `23` | HTTP 403 |
| `24` | HTTP 404 |
| `29` | HTTP 409 |
| `40` | Other HTTP 4xx |
| `50` | HTTP 5xx |
| `60` | Transport or connection failure |
| `70` | Unknown error |
