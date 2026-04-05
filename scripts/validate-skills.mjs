import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import {
  buildEntries,
  collectRelativeFiles,
  listDirectories,
  loadManifest,
  pathExists,
  readJson,
  repoRoot,
} from "./_shared.mjs";

const execFile = promisify(execFileCallback);
const options = new Set(process.argv.slice(2));
const skipCli = options.has("--skip-cli");

function usage() {
  console.log("Usage: node scripts/validate-skills.mjs [--skip-cli]");
}

if (options.has("--help") || options.has("-h")) {
  usage();
  process.exit(0);
}

for (const option of options) {
  if (!["--skip-cli"].includes(option)) {
    usage();
    throw new Error(`Unsupported option: ${option}`);
  }
}

const manifest = await loadManifest(repoRoot);
const entries = buildEntries(manifest, repoRoot);
const errors = [];
const warnings = [];

async function readSkillInstallName(skillPath) {
  const content = await fs.readFile(skillPath, "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    return null;
  }

  const nameMatch = /^name:\s*(.+)$/m.exec(match[1]);
  return nameMatch ? nameMatch[1].trim().replace(/^['"]|['"]$/g, "") : null;
}

async function ensurePath(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!(await pathExists(absolutePath))) {
    errors.push(`Missing required path: ${relativePath}`);
  }
}

async function validateReadmeContains(relativePath, requiredText) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!(await pathExists(absolutePath))) {
    errors.push(`Missing required path: ${relativePath}`);
    return;
  }

  const content = await fs.readFile(absolutePath, "utf8");
  if (!content.includes(requiredText)) {
    errors.push(`${relativePath} must include: ${requiredText}`);
  }
}

await Promise.all([
  ensurePath("README.md"),
  ensurePath("sources.yaml"),
  ensurePath("docs/maintainer-workflow.md"),
  ensurePath("skills/README.md"),
  ensurePath("scripts/sync-skills.mjs"),
  ensurePath("scripts/validate-skills.mjs"),
  ensurePath(".github/workflows/sync-skills.yml"),
]);

await Promise.all([
  validateReadmeContains("README.md", "npx skills add newbe36524/myskills -g --all"),
  validateReadmeContains("README.md", "npx skills add . --list"),
  validateReadmeContains("docs/maintainer-workflow.md", "node scripts/sync-skills.mjs"),
  validateReadmeContains("docs/maintainer-workflow.md", "node scripts/validate-skills.mjs"),
]);

const expectedNames = new Set(entries.map((entry) => entry.targetName));
const actualDirectories = await listDirectories(manifest.skillsRootPath);

for (const directoryName of actualDirectories) {
  const skillRoot = path.join(manifest.skillsRootPath, directoryName);
  const skillDocument = path.join(skillRoot, "SKILL.md");
  const metadataPath = path.join(skillRoot, manifest.metadataFile);

  if (!(await pathExists(skillDocument))) {
    errors.push(`Skill directory is missing SKILL.md: ${path.posix.join(manifest.skillsRoot, directoryName)}`);
  }

  if (!(await pathExists(metadataPath))) {
    errors.push(
      `Skill directory is missing ${manifest.metadataFile}: ${path.posix.join(
        manifest.skillsRoot,
        directoryName,
      )}`,
    );
    continue;
  }

  if (!expectedNames.has(directoryName)) {
    const metadata = await readJson(metadataPath);
    if (metadata.managed && metadata.managedBy === manifest.managedBy) {
      errors.push(`Managed directory is not declared in sources.yaml: ${directoryName}`);
    } else {
      warnings.push(`Unmanaged directory present under skills/: ${directoryName}`);
    }
  }
}

for (const entry of entries) {
  const targetRoot = entry.targetPath;
  const metadataPath = path.join(targetRoot, manifest.metadataFile);

  if (!(await pathExists(targetRoot))) {
    errors.push(`Missing managed skill directory: ${entry.targetPathRelative}`);
    continue;
  }

  if (!(await pathExists(path.join(targetRoot, "SKILL.md")))) {
    errors.push(`Missing SKILL.md in ${entry.targetPathRelative}`);
  }

  if (!(await pathExists(metadataPath))) {
    errors.push(`Missing provenance metadata in ${entry.targetPathRelative}`);
    continue;
  }

  const metadata = await readJson(metadataPath);
  const actualFiles = (await collectRelativeFiles(targetRoot)).filter(
    (filePath) => filePath !== manifest.metadataFile,
  );

  const expectedFields = {
    managed: true,
    managedBy: manifest.managedBy,
    sourceKey: entry.sourceKey,
    sourceKind: entry.sourceKind,
    sourceLabel: entry.sourceLabel,
    sourceRoot: entry.sourceRoot,
    sourcePath: entry.sourcePath,
    originalName: entry.originalName,
    installName: entry.targetName,
    targetName: entry.targetName,
    targetPath: entry.targetPathRelative,
    remoteRepository: manifest.remoteRepository,
  };

  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    if (metadata[field] !== expectedValue) {
      errors.push(
        `Metadata mismatch for ${entry.targetPathRelative}: expected ${field}=${JSON.stringify(
          expectedValue,
        )}, got ${JSON.stringify(metadata[field])}`,
      );
    }
  }

  if (!Array.isArray(metadata.files)) {
    errors.push(`Metadata files list is missing for ${entry.targetPathRelative}`);
    continue;
  }

  const installName = await readSkillInstallName(path.join(targetRoot, "SKILL.md"));
  if (installName !== entry.targetName) {
    errors.push(
      `SKILL.md frontmatter name mismatch for ${entry.targetPathRelative}: expected ${entry.targetName}, got ${JSON.stringify(
        installName,
      )}`,
    );
  }

  const metadataFiles = [...metadata.files].sort((left, right) => left.localeCompare(right));
  const sortedActualFiles = [...actualFiles].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(metadataFiles) !== JSON.stringify(sortedActualFiles)) {
    errors.push(`Metadata file list drift detected in ${entry.targetPathRelative}`);
  }
}

if (!skipCli) {
  try {
    const { stdout, stderr } = await execFile(
      "npx",
      ["--yes", "skills@1.4.8", "add", ".", "--list"],
      { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024, timeout: 45000 },
    );
    const cliOutput = `${stdout}${stderr}`;

    for (const entry of entries) {
      if (!cliOutput.includes(entry.targetName)) {
        errors.push(`skills CLI listing does not mention ${entry.targetName}`);
      }
    }
  } catch (error) {
    const details = error.stdout || error.stderr || error.message;
    errors.push(`skills CLI validation failed: ${details}`);
  }
}

if (warnings.length > 0) {
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validation succeeded for ${entries.length} managed skills.`);
