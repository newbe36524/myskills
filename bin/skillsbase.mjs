#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = require.resolve("@hagicode/skillsbase/package.json");
const packagedCliPath = path.join(path.dirname(packageJsonPath), "bin", "skillsbase.mjs");

function hasFlag(argv, flagName) {
  return argv.includes(flagName);
}

function resolveCommand(argv) {
  return argv.find((value) => !value.startsWith("-")) ?? null;
}

function isHostedGithubActions(env) {
  return env.GITHUB_ACTIONS === "true" || env.SKILLSBASE_HOSTED_CI === "1";
}

function normalizeArgv(argv, env) {
  const nextArgv = [...argv];
  const command = resolveCommand(nextArgv);
  const checkMode = hasFlag(nextArgv, "--check");

  if (command && !hasFlag(nextArgv, "--repo")) {
    nextArgv.push("--repo", repoRoot);
  }

  if (
    command === "sync" &&
    checkMode &&
    isHostedGithubActions(env) &&
    !hasFlag(nextArgv, "--allow-missing-sources")
  ) {
    nextArgv.push("--allow-missing-sources");
  }

  return nextArgv;
}

const child = spawn(process.execPath, [packagedCliPath, ...normalizeArgv(process.argv.slice(2), process.env)], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (error) => {
  throw error;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
