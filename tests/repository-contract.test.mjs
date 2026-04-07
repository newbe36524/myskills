import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.resolve(repoRoot, "..", "skillsbase-template");
const baselineOwnedPaths = [
  "package.json",
  "package-lock.json",
  "sources.yaml",
  "README.md",
  "docs/maintainer-workflow.md",
  "skills/README.md",
  ".github/workflows/skills-sync.yml",
  ".github/actions/skillsbase-sync/action.yml",
];
const extensionOwnedPaths = ["tests/repository-contract.test.mjs"];
const obsoletePaths = [
  "bin/skillsbase.mjs",
  "scripts/sync-skills.mjs",
  "scripts/validate-skills.mjs",
  "source-roots/vendored-first-party",
];

function parseScalar(rawValue) {
  const value = rawValue.trim();
  if (value.length === 0) {
    return "";
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest(customRepoRoot = repoRoot) {
  const manifestPath = path.join(customRepoRoot, "sources.yaml");
  const text = await fs.readFile(manifestPath, "utf8");
  const manifest = { sources: [] };
  const lines = text.split(/\r?\n/);
  let currentSource = null;
  let currentListKey = null;

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.replace(/\s+$/, "");
    const lineNumber = index + 1;

    if (line.length === 0 || line.trimStart().startsWith("#")) {
      continue;
    }

    const topLevelMatch = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (topLevelMatch && !line.startsWith(" ")) {
      const [, key, value] = topLevelMatch;
      if (key === "sources") {
        currentSource = null;
        currentListKey = null;
      } else {
        manifest[key] = parseScalar(value);
      }
      continue;
    }

    const sourceStartMatch = /^  - key:\s*(.+)$/.exec(line);
    if (sourceStartMatch) {
      currentSource = { key: parseScalar(sourceStartMatch[1]), include: [] };
      manifest.sources.push(currentSource);
      currentListKey = null;
      continue;
    }

    const sourcePropertyMatch = /^    ([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (sourcePropertyMatch && currentSource) {
      const [, key, value] = sourcePropertyMatch;
      if (value.length === 0) {
        currentSource[key] = [];
        currentListKey = key;
      } else {
        currentSource[key] = parseScalar(value);
        currentListKey = null;
      }
      continue;
    }

    const listItemMatch = /^      - (.+)$/.exec(line);
    if (listItemMatch && currentSource && currentListKey) {
      currentSource[currentListKey].push(parseScalar(listItemMatch[1]));
      continue;
    }

    throw new Error(`Unsupported sources.yaml syntax at line ${lineNumber}: ${rawLine}`);
  }

  return {
    ...manifest,
    skillsCliVersion:
      typeof manifest.skillsCliVersion === "string" ? manifest.skillsCliVersion : "1.4.8",
    installAgent: typeof manifest.installAgent === "string" ? manifest.installAgent : "codex",
    skillsRootPath: path.join(customRepoRoot, manifest.skillsRoot),
  };
}

function buildEntries(manifest, customRepoRoot = repoRoot) {
  return manifest.sources
    .flatMap((source) =>
      source.include.map((originalName) => {
        const targetName = `${source.targetPrefix}${originalName}`;
        const sourcePath =
          source.kind === "github-repository"
            ? `${source.root}@${originalName}`
            : path.join(source.root, originalName);
        return {
          sourceKey: source.key,
          sourceLabel: source.label,
          sourceKind: source.kind,
          sourceRoot: source.root,
          sourcePath,
          originalName,
          targetName,
          targetPath: path.join(customRepoRoot, manifest.skillsRoot, targetName),
          targetPathRelative: path.posix.join(manifest.skillsRoot, targetName),
        };
      }),
    )
    .sort((left, right) => left.targetName.localeCompare(right.targetName));
}

async function listDirectories(rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function collectRelativeFiles(rootPath, basePath = rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(absolutePath, basePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(path.relative(basePath, absolutePath).split(path.sep).join(path.posix.sep));
    }
  }

  return files;
}

async function readSkillInstallName(skillPath) {
  const content = await fs.readFile(skillPath, "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    return null;
  }

  const nameMatch = /^name:\s*(.+)$/m.exec(match[1]);
  return nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

test("repository keeps the template-derived baseline layout and ownership boundaries", async () => {
  for (const relativePath of baselineOwnedPaths) {
    assert.equal(await pathExists(path.join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  }

  if (await pathExists(templateRoot)) {
    for (const relativePath of baselineOwnedPaths) {
      assert.equal(
        await pathExists(path.join(templateRoot, relativePath)),
        true,
        `template baseline missing ${relativePath}`,
      );
    }
  }

  for (const relativePath of extensionOwnedPaths) {
    assert.equal(await pathExists(path.join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  }

  for (const relativePath of obsoletePaths) {
    assert.equal(await pathExists(path.join(repoRoot, relativePath)), false, `obsolete path present: ${relativePath}`);
  }
});

test("maintainer entrypoints stay template-aligned", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.sync, "skillsbase sync --repo .");
  assert.equal(packageJson.scripts["sync:check"], "skillsbase sync --check --repo .");
  assert.equal(packageJson.scripts.test, "node --test ./tests/*.test.mjs");

  const [readme, workflowDoc, skillsReadme, workflow, action] = await Promise.all([
    fs.readFile(path.join(repoRoot, "README.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "docs/maintainer-workflow.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "skills/README.md"), "utf8"),
    fs.readFile(path.join(repoRoot, ".github/workflows/skills-sync.yml"), "utf8"),
    fs.readFile(path.join(repoRoot, ".github/actions/skillsbase-sync/action.yml"), "utf8"),
  ]);

  assert.match(readme, /npm ci/);
  assert.match(readme, /npm install --global @hagicode\/skillsbase/);
  assert.match(readme, /skillsbase github_action --kind all --repo \./);
  assert.doesNotMatch(readme, /bin\/skillsbase\.mjs/);
  assert.match(workflowDoc, /npm ci/);
  assert.match(workflowDoc, /npm install --global @hagicode\/skillsbase/);
  assert.match(workflowDoc, /kind:\s*github-repository/);
  assert.doesNotMatch(workflowDoc, /bin\/skillsbase\.mjs/);
  assert.match(skillsReadme, /GitHub-sourced community skills/);
  assert.match(workflow, /npm install --global @hagicode\/skillsbase/);
  assert.match(workflow, /skillsbase sync --check --repo \./);
  assert.match(action, /npm install --global @hagicode\/skillsbase/);
  assert.match(action, /skillsbase sync --check --repo \./);
});

test("manifest and managed metadata follow the skillsbase contract", async () => {
  const manifest = await loadManifest();
  const manifestText = await fs.readFile(path.join(repoRoot, "sources.yaml"), "utf8");
  assert.equal(manifest.managedBy, "skillsbase");
  assert.equal(manifest.skillsCliVersion, "1.4.8");
  assert.equal(manifest.installAgent, "codex");
  assert.equal(manifest.remoteRepository, "newbe36524/myskills");
  assert.equal(manifest.sources.length, 10);
  assert.match(manifestText, /^installAgent:\s*codex$/m);

  const expectedSources = new Map([
    ["github-awesome-copilot", { root: "github/awesome-copilot", kind: "github-repository" }],
    ["vercel-labs-skills", { root: "vercel-labs/skills", kind: "github-repository" }],
    ["anthropics-skills", { root: "anthropics/skills", kind: "github-repository" }],
    ["hagicode-cli", { root: "HagiCode-org/cli", kind: "github-repository" }],
    ["op7418-humanizer-zh", { root: "op7418/humanizer-zh", kind: "github-repository" }],
    ["nextlevelbuilder-ui-ux-pro-max", { root: "nextlevelbuilder/ui-ux-pro-max-skill", kind: "github-repository" }],
    ["remotion-dev-skills", { root: "remotion-dev/skills", kind: "github-repository" }],
    ["vercel-labs-agent-skills", { root: "vercel-labs/agent-skills", kind: "github-repository" }],
    ["openai-skills-system", { root: "openai/skills", kind: "github-repository" }],
    ["openai-plugins-system", { root: "openai/plugins", kind: "github-repository" }],
  ]);

  for (const source of manifest.sources) {
    const expected = expectedSources.get(source.key);
    assert.notEqual(expected, undefined, `unexpected source key ${source.key}`);
    assert.equal(source.kind, expected.kind);
    assert.equal(source.root, expected.root);
  }

  const entries = buildEntries(manifest);
  const expectedNames = entries.map((entry) => entry.targetName);
  const actualDirectories = await listDirectories(manifest.skillsRootPath);
  assert.deepEqual(actualDirectories, expectedNames);

  for (const entry of entries) {
    const skillPath = path.join(entry.targetPath, "SKILL.md");
    const metadataPath = path.join(entry.targetPath, manifest.metadataFile);
    assert.equal(await pathExists(skillPath), true, `missing SKILL.md in ${entry.targetPathRelative}`);
    assert.equal(await pathExists(metadataPath), true, `missing metadata in ${entry.targetPathRelative}`);

    const metadata = JSON.parse(await fs.readFile(metadataPath, "utf8"));
    const actualFiles = (await collectRelativeFiles(entry.targetPath)).filter(
      (filePath) => filePath !== manifest.metadataFile,
    );

    assert.equal(metadata.managed, true);
    assert.equal(metadata.managedBy, "skillsbase");
    assert.equal(metadata.sourceKey, entry.sourceKey);
    assert.equal(metadata.sourceKind, entry.sourceKind);
    assert.equal(metadata.sourceLabel, entry.sourceLabel);
    assert.equal(metadata.sourceRoot, entry.sourceRoot);
    assert.equal(metadata.sourcePath, entry.sourcePath);
    assert.equal(metadata.originalName, entry.originalName);
    assert.equal(metadata.targetName, entry.targetName);
    assert.equal(metadata.targetPath, entry.targetPathRelative);
    assert.equal(metadata.remoteRepository, manifest.remoteRepository);
    assert.equal(metadata.installAgent, manifest.installAgent);
    assert.equal(metadata.installReference, entry.sourcePath);
    assert.equal(typeof metadata.installedMetadata, "object");
    assert.notEqual(metadata.installedMetadata, null);
    assert.deepEqual(
      [...metadata.files].sort((left, right) => left.localeCompare(right)),
      [...actualFiles].sort((left, right) => left.localeCompare(right)),
    );
    assert.equal(await readSkillInstallName(skillPath), entry.targetName);
    if (!entry.targetName.startsWith("system-")) {
      assert.equal(entry.targetName, entry.originalName);
    }
    if (entry.sourceKey === "openai-skills-system" || entry.sourceKey === "openai-plugins-system") {
      assert.equal(entry.targetName, `system-${entry.originalName}`);
    }
  }
});

test("npx skills add . --list remains compatible with the committed repository", async () => {
  const manifest = await loadManifest();
  const entries = buildEntries(manifest);
  const { stdout, stderr } = await execFile(
    "npx",
    ["--yes", `skills@${manifest.skillsCliVersion}`, "add", ".", "--list"],
    {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    },
  );

  const output = `${stdout}${stderr}`;
  for (const entry of entries) {
    assert.match(output, new RegExp(`(^|\\n).*${entry.targetName}.*($|\\n)`));
  }
});

test("repo-local drift check stays stable outside the repository working directory", async () => {
  const childEnv = { ...process.env };
  delete childEnv.INIT_CWD;

  for (const key of Object.keys(childEnv)) {
    if (key.startsWith("npm_")) {
      delete childEnv[key];
    }
  }

  const { stdout, stderr } = await execFile(
    "npm",
    ["--prefix", repoRoot, "run", "sync:check"],
    {
      cwd: os.tmpdir(),
      env: childEnv,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 420_000,
    },
  );

  assert.match(`${stdout}${stderr}`.toLowerCase(), /no drift detected/);
});
