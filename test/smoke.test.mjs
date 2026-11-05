import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const cli = resolve('dist/cli.js');
const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
test('installed-style CLI reports, thresholds, output protection and invalid input', t => {
  const root = mkdtempSync(join(tmpdir(), 'doc route CLI '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = join(root, 'README.md');
  writeFileSync(input, '# Home\n[good](#home) [bad](missing.md) [external](https://example.invalid?token=synthetic-private)');
  for (const format of ['markdown', 'json', 'html']) {
    const result = run(['check', root, '--format', format]);
    assert.equal(result.status, 2, result.stderr);
    assert.doesNotMatch(result.stdout, /synthetic-private|example\.invalid/);
    if (format === 'json') assert.equal(JSON.parse(result.stdout).summary.errors, 1);
  }
  assert.equal(run(['check', root, '--fail-on', 'none']).status, 0);
  const output = join(root, 'report.html');
  assert.equal(run(['check', root, '--format', 'html', '--output', output]).status, 2);
  const saved = readFileSync(output, 'utf8');
  assert.equal(run(['check', root, '--output', output]).status, 1);
  assert.equal(readFileSync(output, 'utf8'), saved);
  assert.equal(run(['check', root, '--output', input]).status, 1);
  writeFileSync(input, '# Home\n');
  assert.equal(run(['check', root]).status, 0);
  writeFileSync(input, Buffer.from([0xff, 0xfe]));
  assert.equal(run(['check', root]).status, 1);
});
test('warning gate includes unverified fragments', t => {
  const root = mkdtempSync(join(tmpdir(), 'doc route warning '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'README.md'), '[binary](image.png#part)');
  writeFileSync(join(root, 'image.png'), 'synthetic');
  assert.equal(run(['check', root]).status, 0);
  assert.equal(run(['check', root, '--fail-on', 'warning']).status, 2);
});

test('CLI finding gate detects broken links after literal comment examples', t => {
  const root = mkdtempSync(join(tmpdir(), 'doc route literal comment '));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'README.md'), '`<!--` [broken](missing.md)');
  const result = run(['check', root, '--format', 'json']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).checks[0].code, 'MISSING_TARGET');
});
for (const args of [[], ['unknown'], ['check'], ['check', 'missing-root'], ['check', '.', '--format', 'xml'], ['check', '.', '--fail-on', 'invalid'], ['check', '.', '--output'], ['check', '.', '--format', 'json', '--format', 'html']]) {
  test(`CLI argument behavior ${JSON.stringify(args)}`, () => assert.equal(run(args).status, args.length ? 1 : 0));
}
test('help and version do not inspect projects', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--version']).stdout, '0.1.1\n');
});
