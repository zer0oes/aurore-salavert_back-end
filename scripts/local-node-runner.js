'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const allowedScripts = new Set([
  'start-local.js',
  'sync-production-projects.js',
  'localize-imported-media.js',
]);
const requestedScript = process.argv[2];

if (!allowedScripts.has(requestedScript)) {
  console.error('[LOCAL] Missing or unsupported local script.');
  process.exit(1);
}

// Strapi 5.5x uses Array.prototype.toSorted (added in Node 20), so any
// runtime older than that will crash at bootstrap even if better-sqlite3
// loads fine on it.
const MIN_NODE_MAJOR = 20;

const windowsHerokuNode = 'C:\\Program Files\\heroku\\client\\bin\\node.exe';

const nodeMajor = (nodeBinary) => {
  const match = /[\\/]v(\d+)\.\d+\.\d+[\\/]/.exec(nodeBinary);
  return match ? Number(match[1]) : null;
};

// Auto-discover Node versions installed via nvm-windows (https://github.com/coreybutler/nvm-windows),
// so a compatible runtime is picked automatically without requiring `nvm use` beforehand.
const nvmInstalledBinaries = () => {
  const nvmHome = process.env.NVM_HOME;

  if (!nvmHome || !fs.existsSync(nvmHome)) {
    return [];
  }

  return fs
    .readdirSync(nvmHome)
    .filter((entry) => /^v\d+\.\d+\.\d+$/.test(entry))
    .map((entry) => path.join(nvmHome, entry, 'node.exe'))
    .sort((a, b) => nodeMajor(b) - nodeMajor(a));
};

const candidates = [
  process.env.LOCAL_NODE_BINARY,
  ...nvmInstalledBinaries(),
  process.execPath,
  process.platform === 'win32' ? windowsHerokuNode : null,
].filter((candidate, index, values) => candidate && values.indexOf(candidate) === index);

const supportsLocalSqlite = (nodeBinary) => {
  if (!fs.existsSync(nodeBinary)) {
    return false;
  }

  const check = spawnSync(
    nodeBinary,
    [
      '-e',
      "const Database=require('better-sqlite3');const db=new Database(':memory:');db.close();",
    ],
    { cwd: appDir, stdio: 'ignore' }
  );

  return check.status === 0;
};

// Prefer a runtime that satisfies both constraints (Strapi + better-sqlite3).
// Fall back to any working better-sqlite3 runtime, with a warning, so the
// script still runs on setups without a >=20 Node install.
const nodeBinary =
  candidates.find((candidate) => {
    const major = nodeMajor(candidate);
    return (major === null || major >= MIN_NODE_MAJOR) && supportsLocalSqlite(candidate);
  }) || candidates.find(supportsLocalSqlite);

if (!nodeBinary) {
  console.error('[LOCAL] No compatible Node runtime was found.');
  console.error('[LOCAL] Install the project Node version, run npm install, or set LOCAL_NODE_BINARY.');
  process.exit(1);
}

if (nodeMajor(nodeBinary) !== null && nodeMajor(nodeBinary) < MIN_NODE_MAJOR) {
  console.warn(`[LOCAL] Warning: only Node < ${MIN_NODE_MAJOR} is available; Strapi may fail to start.`);
  console.warn('[LOCAL] Install a newer Node version with nvm (e.g. `nvm install 22`).');
}

const version = spawnSync(nodeBinary, ['--version'], { encoding: 'utf8' }).stdout.trim();
console.log(`[LOCAL] Compatible runtime: ${nodeBinary} (${version})`);

if (process.argv.includes('--check')) {
  process.exit(0);
}

const result = spawnSync(nodeBinary, [path.join(__dirname, requestedScript)], {
  cwd: appDir,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
