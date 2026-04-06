<!-- Managed by skillsbase CLI. -->

# Maintainer Workflow

结论是：维护流以 `npm ci -> npm run sync -> npm test` 为主。

## Lifecycle

1. `npm ci`
2. `npm run sync`
3. `npm test`
4. `npm run sync:check`
5. `node ./bin/skillsbase.mjs github_action --kind all`

## Source policy

- `sources.yaml` 是单一真相源。
- 第一方来源根目录：`/home/newbe36524/.agents/skills`
- 系统镜像来源根目录：`/home/newbe36524/.codex/skills/.system`
- `skills/` 只保存受管输出。
- `.skill-source.json` 记录来源、安装器元数据与受管文件列表。

## Naming rules

- 第一方技能保持原名：`skills/<name>/`
- 系统镜像技能保持 `system-` 前缀：`skills/system-<name>/`
- 若名称冲突，第一方名称优先，系统镜像继续使用前缀名

## Validation lanes

- `npm test` 校验提交产物、元数据约束与 `npx skills add . --list` 兼容性，不依赖本地来源根目录。
- `npm run sync:check` 只校验漂移，不改仓库。
- `node ./bin/skillsbase.mjs sync --check` 在 GitHub-hosted Actions 中会自动补 `--allow-missing-sources`。

## Notes

- 勿再以 `scripts/sync-skills.mjs` 或 `scripts/validate-skills.mjs` 作为主流程。
- 远程安装路径保持不变：`npx skills add newbe36524/myskills -g --all`
