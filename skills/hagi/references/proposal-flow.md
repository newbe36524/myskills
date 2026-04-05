# Proposal Flow

Treat the proposal lifecycle as explicit, non-interactive backend actions.
One CLI command maps to one backend action.
Do not imply hidden chaining between `create`, `generate-name`, `generate`, `annotate`, `execute`, `archive`, and `complete`.

## Configuration first

Confirm the backend target before discussing proposal commands:

- `--base-url <url>` or `HAGI_API_BASE_URL`
- `--token <token>` or `HAGI_API_TOKEN`
- `--lang <lang>` or `HAGI_API_LANG`
- `--json` for automation and machine-readable output

## Explicit lifecycle sequence

Use this order when explaining or validating proposal flows:

1. `proposal list`
2. `proposal create`
3. `proposal generate-name`
4. `proposal optimize-description` (optional)
5. `proposal generate`
6. `proposal annotate` (optional review loop)
7. `proposal execute`
8. `proposal archive`
9. `proposal complete`
10. `proposal send` for follow-up conversation on the active session

The CLI may suggest a next command, but it does not call later lifecycle APIs automatically.

## Published package examples

List sessions:

```bash
npx @hagicode/cli proposal list --json
```

Create a proposal session:

```bash
npx @hagicode/cli proposal create \
  --project-id <project-id> \
  --chief-complaint "Add CLI completion for session workflows" \
  --default-title \
  --json
```

Generate the proposal name:

```bash
npx @hagicode/cli proposal generate-name \
  --session-id <session-id> \
  --json
```

Optimize the description explicitly:

```bash
npx @hagicode/cli proposal optimize-description \
  --session-id <session-id> \
  --description "Improve the proposal framing" \
  --optimization-direction "Focus on implementation risk" \
  --json
```

Generate the proposal body:

```bash
npx @hagicode/cli proposal generate \
  --session-id <session-id> \
  --enable-explore-mode \
  --json
```

Submit annotations from a file or stdin:

```bash
npx @hagicode/cli proposal annotate --session-id <session-id> --input annotations.json
cat annotations.json | npx @hagicode/cli proposal annotate --session-id <session-id> --input - --json
```

Execute, archive, complete, or continue the session:

```bash
npx @hagicode/cli proposal execute --session-id <session-id> --json
npx @hagicode/cli proposal archive --session-id <session-id> --hero-id <hero-id>
npx @hagicode/cli proposal status --session-id <session-id> --status Reviewing
npx @hagicode/cli proposal complete --session-id <session-id>
npx @hagicode/cli proposal send --session-id <session-id> --content "Please continue"
```

## Validation focus

After each lifecycle step:

- inspect JSON output or the suggested next command
- confirm the session identifier used by the next command
- check exit codes when the caller needs scripting guarantees
- switch to `repos/cli` maintainer workflows only if package-level behavior is insufficient
