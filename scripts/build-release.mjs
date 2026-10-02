import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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

function hasInstaller(dir) {
  return readdirSync(dir).some((name) => /\.exe$/i.test(name) && !name.toLowerCase().endsWith('.blockmap'));
}

/** @returns {Semver[]} */
function existingReleaseVersions() {
  if (!existsSync(releaseRoot)) {
    return [];
  }
  return readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && hasInstaller(path.join(releaseRoot, entry.name)))
    .map((entry) => parseSemver(entry.name))
    .filter((version) => version !== null);
}

function removeIfExists(dir) {
  if (!existsSync(dir)) {
    return;
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[build] could not remove ${dir}: ${error.message}`);
  }
}

/**
 * Empties an existing release folder so the rebuild fully replaces it.
 * Aborts the build if something (e.g. a running installer) blocks the removal,
 * so we never end up with a mix of old and new files.
 * @param {string} dir
 */
function clearDirOrExit(dir) {
  if (!existsSync(dir)) {
    return;
  }
  for (const name of readdirSync(dir)) {
    try {
      rmSync(path.join(dir, name), { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch (error) {
      console.error(`[build] could not remove ${path.join(dir, name)}: ${error.message}`);
      console.error('[build] close any app/installer using these files and try again.');
      process.exit(1);
    }
  }
}

/**
 * Always use the package.json version when its release folder already exists
 * (the old build is overwritten). If the version is free and not behind the
 * existing releases, use it as is; otherwise bump patch past the latest release.
 */
function nextReleaseVersion() {
  const pkg = readPackageVersion();
  const existing = existingReleaseVersions();
  const taken = new Set(existing.map((version) => version.text));
  const max = [pkg, ...existing].sort(compareSemver).at(-1) ?? pkg;

  if (taken.has(pkg.text) || compareSemver(pkg, max) >= 0) {
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
 * @param {NodeJS.ProcessEnv} [extraEnv]
 */
function run(command, args, extraEnv) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
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
  const overwrite = existsSync(path.join(releaseRoot, version));
  const action = version === current ? (overwrite ? 'overwrite' : 'keep') : `bump ${current} →`;
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
const absOutDir = path.join(root, outDir);
mkdirSync(absOutDir, { recursive: true });
removeIfExists(path.join(absOutDir, 'win-unpacked.tmp'));
removeIfExists(path.join(absOutDir, 'win-unpacked'));
console.log(`[build] output → ${outDir}`);

const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
if (!existsSync(path.join(electronDist, 'electron.exe'))) {
  console.error(`[build] missing Electron binary: ${path.join(electronDist, 'electron.exe')}`);
  process.exit(1);
}

const renameRetry = path.join(root, 'scripts', 'win-fs-rename-retry.cjs').replaceAll('\\', '/');
const nodeOptions = [process.env.NODE_OPTIONS, `--require ${renameRetry}`].filter(Boolean).join(' ');

run('npx', ['tsc', '-b']);
run('npx', ['vite', 'build']);

// Compilation succeeded: now it is safe to drop the previous build of this version.
if (existsSync(absOutDir) && readdirSync(absOutDir).length > 0) {
  console.log(`[build] overwriting existing ${outDir}`);
  clearDirOrExit(absOutDir);
}
run(
  'npx',
  [
    'electron-builder',
    `--config.directories.output=${outDir}`,
    `--config.electronDist=${electronDist.replaceAll('\\', '/')}`,
  ],
  { NODE_OPTIONS: nodeOptions },
);

console.log(`[build] done: ${outDir}`);
