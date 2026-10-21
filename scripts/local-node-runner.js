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

// Strapi 5.59 uses undici 8, which requires Node >=22.19.

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

// Check the executable itself, including paths without an embedded version.
const nodeBinary = candidates.find((candidate) => {
  const version = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
  const match = /^v(\d+)\.(\d+)\./.exec(version.stdout || '');
  const major = Number(match?.[1]);
  const minor = Number(match?.[2]);
  return (major > 22 || (major === 22 && minor >= 19)) && supportsLocalSqlite(candidate);
});

if (!nodeBinary) {
  console.error('[LOCAL] No compatible Node runtime was found.');
  console.error('[LOCAL] Install the project Node version, run npm install, or set LOCAL_NODE_BINARY.');
  process.exit(1);
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
