import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");
export const sourcesManifestPath = path.join(repoRoot, "sources.yaml");

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

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function loadManifest(customRepoRoot = repoRoot) {
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

  const requiredTopLevelKeys = [
    "version",
    "skillsRoot",
    "metadataFile",
    "managedBy",
    "remoteRepository",
    "staleCleanup",
  ];

  for (const key of requiredTopLevelKeys) {
    if (!(key in manifest)) {
      throw new Error(`Missing required manifest key: ${key}`);
    }
  }

  if (!Array.isArray(manifest.sources) || manifest.sources.length === 0) {
    throw new Error("Manifest must declare at least one source.");
  }

  for (const source of manifest.sources) {
    const requiredSourceKeys = ["key", "label", "kind", "root", "targetPrefix", "include"];
    for (const key of requiredSourceKeys) {
      if (!(key in source)) {
        throw new Error(`Source "${source.key ?? "<unknown>"}" is missing key "${key}".`);
      }
    }

    if (!Array.isArray(source.include) || source.include.length === 0) {
      throw new Error(`Source "${source.key}" must define a non-empty include list.`);
    }
  }

  return {
    ...manifest,
    manifestPath,
    skillsRootPath: path.join(customRepoRoot, manifest.skillsRoot),
  };
}

export function buildEntries(manifest, customRepoRoot = repoRoot) {
  const entries = [];

  for (const source of manifest.sources) {
    for (const originalName of source.include) {
      const targetName = `${source.targetPrefix}${originalName}`;
      entries.push({
        sourceKey: source.key,
        sourceLabel: source.label,
        sourceKind: source.kind,
        sourceRoot: source.root,
        sourcePath: path.join(source.root, originalName),
        originalName,
        targetName,
        targetPath: path.join(customRepoRoot, manifest.skillsRoot, targetName),
        targetPathRelative: path.posix.join(manifest.skillsRoot, targetName),
      });
    }
  }

  const collisions = new Map();
  for (const entry of entries) {
    const names = collisions.get(entry.targetName) ?? [];
    names.push(entry.sourceKey);
    collisions.set(entry.targetName, names);
  }

  const duplicateTargets = [...collisions.entries()].filter(([, keys]) => keys.length > 1);
  if (duplicateTargets.length > 0) {
    const rendered = duplicateTargets
      .map(([targetName, keys]) => `${targetName} (${keys.join(", ")})`)
      .join(", ");
    throw new Error(`Manifest target-name collision detected: ${rendered}`);
  }

  return entries.sort((left, right) => left.targetName.localeCompare(right.targetName));
}

export async function listDirectories(rootPath) {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function collectRelativeFiles(rootPath, basePath = rootPath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const files = [];

  for (const entry of [...entries].sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectRelativeFiles(absolutePath, basePath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(toPosix(path.relative(basePath, absolutePath)));
    }
  }

  return files;
}

export function toPosix(filePath) {
  return filePath.split(path.sep).join(path.posix.sep);
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export function buildMetadata(manifest, entry, files) {
  return {
    schemaVersion: 1,
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
    files: [...files].sort((left, right) => left.localeCompare(right)),
  };
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function rewriteSkillName(content, targetName) {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!frontmatterMatch) {
    throw new Error("SKILL.md is missing YAML frontmatter.");
  }

  if (!/^name:\s*.+$/m.test(frontmatterMatch[1])) {
    throw new Error("SKILL.md frontmatter is missing a name field.");
  }

  const updatedFrontmatter = frontmatterMatch[1].replace(/^name:\s*.+$/m, `name: ${targetName}`);
  return content.replace(frontmatterMatch[0], `---\n${updatedFrontmatter}\n---`);
}

export async function copyManagedSkill(entry, targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
  await fs.mkdir(targetPath, { recursive: true });
  await fs.cp(entry.sourcePath, targetPath, { recursive: true, force: true });

  const skillPath = path.join(targetPath, "SKILL.md");
  const skillContent = await fs.readFile(skillPath, "utf8");
  const rewritten = rewriteSkillName(skillContent, entry.targetName);
  await fs.writeFile(skillPath, rewritten, "utf8");
}

export async function readManagedSkillContent(entry, relativePath) {
  const absolutePath = path.join(entry.sourcePath, relativePath);
  if (relativePath !== "SKILL.md") {
    return fs.readFile(absolutePath);
  }

  const skillContent = await fs.readFile(absolutePath, "utf8");
  return Buffer.from(rewriteSkillName(skillContent, entry.targetName), "utf8");
}
