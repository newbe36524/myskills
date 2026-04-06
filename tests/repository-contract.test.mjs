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
const packageCliPath = path.join(
  repoRoot,
  "node_modules",
  "@hagicode",
  "skillsbase",
  "bin",
  "skillsbase.mjs",
);

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
    manifestPath,
    skillsRootPath: path.join(customRepoRoot, manifest.skillsRoot),
  };
}

function buildEntries(manifest, customRepoRoot = repoRoot) {
  return manifest.sources
    .flatMap((source) =>
      source.include.map((originalName) => {
        const targetName = `${source.targetPrefix}${originalName}`;
        return {
          sourceKey: source.key,
          sourceLabel: source.label,
          sourceKind: source.kind,
          sourceRoot: source.root,
          sourcePath: path.join(source.root, originalName),
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

test("repository exposes the managed baseline files and maintainer entrypoints", async () => {
  const requiredPaths = [
    "package.json",
    "package-lock.json",
    "bin/skillsbase.mjs",
    "sources.yaml",
    "README.md",
    "docs/maintainer-workflow.md",
    "skills/README.md",
    ".github/workflows/skills-sync.yml",
    ".github/actions/skillsbase-sync/action.yml",
  ];

  for (const relativePath of requiredPaths) {
    assert.equal(await pathExists(path.join(repoRoot, relativePath)), true, `missing ${relativePath}`);
  }

  const [readme, workflow, skillsReadme] = await Promise.all([
    fs.readFile(path.join(repoRoot, "README.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "docs/maintainer-workflow.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "skills/README.md"), "utf8"),
  ]);

  assert.match(readme, /npx skills add newbe36524\/myskills -g --all/);
  assert.match(readme, /npm run sync/);
  assert.match(readme, /npm test/);
  assert.doesNotMatch(readme, /scripts\/sync-skills\.mjs/);
  assert.doesNotMatch(readme, /scripts\/validate-skills\.mjs/);
  assert.match(workflow, /Managed by skillsbase CLI/);
  assert.match(workflow, /node \.\/bin\/skillsbase\.mjs github_action --kind all|GitHub-hosted Actions/);
  assert.match(skillsReadme, /Managed by skillsbase CLI/);
});

test("manifest and managed metadata follow the skillsbase contract", async () => {
  const manifest = await loadManifest();
  const manifestText = await fs.readFile(path.join(repoRoot, "sources.yaml"), "utf8");
  assert.equal(manifest.managedBy, "skillsbase");
  assert.equal(manifest.skillsCliVersion, "1.4.8");
  assert.doesNotMatch(manifestText, /^installAgent:/m);
  assert.equal(manifest.installAgent, "codex");
  assert.equal(manifest.remoteRepository, "newbe36524/myskills");

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

test("repo-local wrapper makes sync --check deterministic on GitHub-hosted CI", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "myskills-wrapper-test-"));
  const targetRepo = path.join(tempRoot, "repo");
  await fs.mkdir(targetRepo, { recursive: true });
  await fs.cp(path.join(repoRoot, "skills"), path.join(targetRepo, "skills"), { recursive: true });

  const manifest = await loadManifest();
  const rewrittenManifest = [
    "# Managed by skillsbase CLI.",
    "# Edit source entries to add or remove managed skills.",
    "version: 1",
    "skillsRoot: skills",
    "metadataFile: .skill-source.json",
    "managedBy: skillsbase",
    "remoteRepository: newbe36524/myskills",
    "staleCleanup: true",
    `skillsCliVersion: ${manifest.skillsCliVersion}`,
    `installAgent: ${manifest.installAgent}`,
    "sources:",
    '  - key: first-party',
    '    label: "First-party local skills"',
    "    kind: first-party",
    `    root: ${path.join(tempRoot, "missing-first-party")}`,
    '    targetPrefix: ""',
    "    include:",
    ...manifest.sources[0].include.map((skillName) => `      - ${skillName}`),
    '  - key: system',
    '    label: "Mirrored system skills"',
    "    kind: mirrored-system",
    `    root: ${path.join(tempRoot, "missing-system")}`,
    "    targetPrefix: system-",
    "    include:",
    ...manifest.sources[1].include.map((skillName) => `      - ${skillName}`),
    "",
  ].join("\n");
  await fs.writeFile(path.join(targetRepo, "sources.yaml"), rewrittenManifest, "utf8");

  await assert.rejects(
    execFile(process.execPath, [packageCliPath, "sync", "--check", "--repo", targetRepo], {
      cwd: repoRoot,
      env: {
        ...process.env,
        GITHUB_ACTIONS: "true",
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    }),
  );

  const { stdout, stderr } = await execFile(
    process.execPath,
    [path.join(repoRoot, "bin", "skillsbase.mjs"), "sync", "--check", "--repo", targetRepo],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        GITHUB_ACTIONS: "true",
      },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
    },
  );

  const output = `${stdout}${stderr}`.toLowerCase();
  assert.match(output, /skipped missing sources|no drift detected/);
});
