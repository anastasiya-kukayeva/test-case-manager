import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const releaseRoot = path.join(root, 'release');

/**
 * @typedef {{ major: number, minor: number, patch: number, text: string }} Semver
 */

/**
 * @param {string} value
 * @returns {Semver | null}
 */
function parseSemver(value) {
  const match = String(value)
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    text: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

/**
 * @param {Semver} left
 * @param {Semver} right
 */
function compareSemver(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

/**
 * @param {Semver} version
 * @returns {Semver}
 */
function bumpPatch(version) {
  const patch = version.patch + 1;
  return {
    major: version.major,
    minor: version.minor,
    patch,
    text: `${version.major}.${version.minor}.${patch}`,
  };
}

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  return parseSemver(pkg.version) ?? { major: 1, minor: 0, patch: 0, text: '1.0.0' };
}

/** @returns {Semver[]} */
function existingReleaseVersions() {
  if (!existsSync(releaseRoot)) {
    return [];
  }
  return readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => parseSemver(entry.name))
    .filter((version) => version !== null);
}

/**
 * Keep the current package version if that folder is still free; otherwise
 * bump patch until a new release folder name is available.
 */
function nextReleaseVersion() {
  const pkg = readPackageVersion();
  const existing = existingReleaseVersions();
  const taken = new Set(existing.map((version) => version.text));
  const max = [pkg, ...existing].sort(compareSemver).at(-1) ?? pkg;

  if (!taken.has(pkg.text) && compareSemver(pkg, max) >= 0) {
    return pkg.text;
  }

  let next = bumpPatch(max);
  while (taken.has(next.text)) {
    next = bumpPatch(next);
  }
  return next.text;
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const version = nextReleaseVersion();
const current = readPackageVersion().text;
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  const outDir = path.posix.join('release', version);
  const action = version === current ? 'keep' : `bump ${current} →`;
  console.log(`[build] ${action} ${version}`);
  console.log(`[build] output → ${outDir}`);
  process.exit(0);
}
if (version !== current) {
  console.log(`[build] bump version ${current} → ${version}`);
  execSync(`npm version ${version} --no-git-tag-version`, {
    cwd: root,
    stdio: 'inherit',
  });
} else {
  console.log(`[build] version ${version}`);
}

const outDir = path.posix.join('release', version);
mkdirSync(path.join(root, outDir), { recursive: true });
console.log(`[build] output → ${outDir}`);

run('npx', ['tsc', '-b']);
run('npx', ['vite', 'build']);
run('npx', ['electron-builder', `--config.directories.output=${outDir}`]);

console.log(`[build] done: ${outDir}`);
