import { promises as fs } from "node:fs";
import path from "node:path";

import {
  buildEntries,
  buildMetadata,
  collectRelativeFiles,
  copyManagedSkill,
  listDirectories,
  loadManifest,
  pathExists,
  readManagedSkillContent,
  readJson,
  repoRoot,
  stableJson,
} from "./_shared.mjs";

const options = new Set(process.argv.slice(2));
const checkMode = options.has("--check");
const allowMissingSources = options.has("--allow-missing-sources");

function usage() {
  console.log("Usage: node scripts/sync-skills.mjs [--check] [--allow-missing-sources]");
}

if (options.has("--help") || options.has("-h")) {
  usage();
  process.exit(0);
}

for (const option of options) {
  if (!["--check", "--allow-missing-sources"].includes(option)) {
    usage();
    throw new Error(`Unsupported option: ${option}`);
  }
}

const manifest = await loadManifest(repoRoot);
const allEntries = buildEntries(manifest, repoRoot);
await fs.mkdir(manifest.skillsRootPath, { recursive: true });

const activeEntries = [];
const skippedSources = [];
const declaredTargets = new Set(allEntries.map((entry) => entry.targetName));

for (const source of manifest.sources) {
  const rootExists = await pathExists(source.root);
  if (!rootExists) {
    if (allowMissingSources) {
      skippedSources.push(`${source.key}: ${source.root}`);
      continue;
    }

    throw new Error(`Managed source root does not exist: ${source.root}`);
  }

  const sourceEntries = allEntries.filter((entry) => entry.sourceKey === source.key);
  for (const entry of sourceEntries) {
    if (!(await pathExists(entry.sourcePath))) {
      throw new Error(`Managed skill is missing from source root: ${entry.sourcePath}`);
    }
  }

  activeEntries.push(...sourceEntries);
}

const changes = [];

for (const entry of activeEntries) {
  const sourceFiles = await collectRelativeFiles(entry.sourcePath);
  const metadata = buildMetadata(manifest, entry, sourceFiles);
  const targetExists = await pathExists(entry.targetPath);
  const metadataPath = path.join(entry.targetPath, manifest.metadataFile);

  if (checkMode) {
    if (!targetExists) {
      changes.push(`missing target directory: ${entry.targetPathRelative}`);
      continue;
    }

    const targetFiles = (await collectRelativeFiles(entry.targetPath)).filter(
      (filePath) => filePath !== manifest.metadataFile,
    );

    if (JSON.stringify(sourceFiles) !== JSON.stringify(targetFiles)) {
      changes.push(`file set drift: ${entry.targetPathRelative}`);
      continue;
    }

    for (const filePath of sourceFiles) {
      const [sourceBuffer, targetBuffer] = await Promise.all([
        readManagedSkillContent(entry, filePath),
        fs.readFile(path.join(entry.targetPath, filePath)),
      ]);

      if (!sourceBuffer.equals(targetBuffer)) {
        changes.push(`file content drift: ${entry.targetPathRelative}/${filePath}`);
        break;
      }
    }

    if (!(await pathExists(metadataPath))) {
      changes.push(`missing metadata: ${path.posix.join(entry.targetPathRelative, manifest.metadataFile)}`);
      continue;
    }

    const existingMetadata = await readJson(metadataPath);
    if (stableJson(existingMetadata) !== stableJson(metadata)) {
      changes.push(`metadata drift: ${path.posix.join(entry.targetPathRelative, manifest.metadataFile)}`);
    }

    continue;
  }

  await copyManagedSkill(entry, entry.targetPath);
  await fs.writeFile(metadataPath, stableJson(metadata), "utf8");
  changes.push(`synced ${entry.targetPathRelative}`);
}

const existingSkillDirectories = await listDirectories(manifest.skillsRootPath);
for (const directoryName of existingSkillDirectories) {
  if (declaredTargets.has(directoryName)) {
    continue;
  }

  const candidatePath = path.join(manifest.skillsRootPath, directoryName);
  const metadataPath = path.join(candidatePath, manifest.metadataFile);
  if (!(await pathExists(metadataPath))) {
    continue;
  }

  const metadata = await readJson(metadataPath);
  if (!metadata.managed || metadata.managedBy !== manifest.managedBy) {
    continue;
  }

  if (checkMode) {
    changes.push(`stale managed directory: ${path.posix.join(manifest.skillsRoot, directoryName)}`);
    continue;
  }

  await fs.rm(candidatePath, { recursive: true, force: true });
  changes.push(`removed stale ${path.posix.join(manifest.skillsRoot, directoryName)}`);
}

if (skippedSources.length > 0) {
  console.log(`Skipped missing managed source roots: ${skippedSources.join(", ")}`);
}

if (changes.length === 0) {
  console.log(checkMode ? "No sync drift detected." : "Nothing to sync.");
  process.exit(0);
}

for (const change of changes) {
  console.log(change);
}

if (checkMode) {
  process.exitCode = 1;
}
