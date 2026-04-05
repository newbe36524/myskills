# Hosted skills

This directory is the installable content root for the `newbe36524/myskills` repository.

## Naming rules

- First-party skills keep their original names: `skills/<name>/`
- Mirrored system skills use a collision-safe prefix: `skills/system-<name>/`
- Each managed skill directory must contain `SKILL.md` and `.skill-source.json`

## Local discovery

List the repository contents with the same tree that remote consumers install from:

```bash
npx skills add . --list
```

Use `node ../scripts/validate-skills.mjs` from this directory or `node scripts/validate-skills.mjs` from the repository root to run the full contract checks.
