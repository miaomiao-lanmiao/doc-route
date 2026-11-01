import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'doc route package '));
assert.ok(process.env.npm_execpath, 'Use npm run check:package.');
function npm(args) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: root, encoding: 'utf8', shell: false, windowsHide: true, timeout: 60000,
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' } });
  assert.equal(result.status, 0, result.stderr);
}
try {
  npm(['pack', '--ignore-scripts', '--pack-destination', temporary]);
  const archive = join(temporary, readdirSync(temporary).find(name => name.endsWith('.tgz')));
  npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', temporary, archive]);
  const installedRoot = join(temporary, 'node_modules/doc-route-cli');
  const manifest = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  writeFileSync(join(temporary, 'README.md'), '# Home\n[ok](#home)');
  const result = spawnSync(process.execPath, [join(installedRoot, 'dist/cli.js'), 'check', temporary, '--format', 'json'], { encoding: 'utf8', cwd: temporary });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.valid, 1);
  const packagedDocs = spawnSync(process.execPath, [join(installedRoot, 'dist/cli.js'), 'check', installedRoot, '--format', 'json'], { encoding: 'utf8', cwd: temporary });
  assert.equal(packagedDocs.status, 0, packagedDocs.stderr + packagedDocs.stdout);
  assert.equal(JSON.parse(packagedDocs.stdout).summary.errors, 0);
  const bin = join(temporary, 'node_modules/.bin');
  const executable = process.platform === 'win32'
    ? spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'docroute.cmd --version'], { cwd: bin, encoding: 'utf8', windowsHide: true })
    : spawnSync(join(bin, 'docroute'), ['--version'], { encoding: 'utf8' });
  assert.equal(executable.status, 0, executable.stderr);
  assert.equal(executable.stdout, `${manifest.version}\n`);
  console.log('Offline package installation, local link check and installed executable passed.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
