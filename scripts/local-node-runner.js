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

const windowsHerokuNode = 'C:\\Program Files\\heroku\\client\\bin\\node.exe';
const candidates = [
  process.env.LOCAL_NODE_BINARY,
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

const nodeBinary = candidates.find(supportsLocalSqlite);

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
