import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { audit, render } from '../dist/index.js';

function fixture(t) {
  const parent = mkdtempSync(join(tmpdir(), 'doc route '));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, '项目 with spaces'); mkdirSync(root);
  return { parent, root };
}
test('real paths, Unicode/spaces, anchors, images and exact case are checked', t => {
  const { root } = fixture(t);
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'README.md'), '[ok](docs/guide.md#install) [root](/docs/guide.md#install) [space](docs/中文%20notes.md) [bad](missing.md) [case](readme.md) [anchor](docs/guide.md#missing)');
  writeFileSync(join(root, 'docs/guide.md'), '# Install\n[back](../README.md)');
  writeFileSync(join(root, 'docs/中文 notes.md'), '# Notes');
  const report = audit(root);
  assert.equal(report.summary.documents, 3);
  assert.equal(report.summary.errors, 3);
  assert.deepEqual(report.checks.filter(check => check.status === 'error').map(check => check.code).sort(), ['CASE_MISMATCH', 'MISSING_ANCHOR', 'MISSING_TARGET']);
  assert.deepEqual(report, audit(root));
});
test('URLs are never emitted and local query strings are omitted', t => {
  const { root } = fixture(t);
  writeFileSync(join(root, 'README.md'), '[remote](https://user:synthetic-secret@example.invalid/?token=synthetic-query) [mail](mailto:private@example.invalid) [query](README.md?token=synthetic-local)');
  const report = audit(root);
  assert.equal(report.summary.external, 2);
  assert.equal(report.summary.valid, 1);
  for (const format of ['json', 'markdown', 'html']) assert.doesNotMatch(render(report, format), /synthetic-|example\.invalid|user:/);
});
test('outside paths, encoded traversal, drives and backslashes stay bounded', t => {
  const { parent, root } = fixture(t);
  writeFileSync(join(parent, 'outside.md'), Buffer.from([0xff]));
  writeFileSync(join(root, 'README.md'), '[outside](../outside.md) [encoded](%2e%2e/outside.md) [drive](C:/private.md) [back](..\\private.md)');
  const report = audit(root);
  assert.equal(report.summary.errors, 4);
  assert.doesNotMatch(JSON.stringify(report), /outside\.md|C:\/private/);
});
test('symlink/junction paths are not followed', t => {
  const { parent, root } = fixture(t);
  const outside = join(parent, 'outside'); mkdirSync(outside);
  writeFileSync(join(outside, 'private.md'), Buffer.from([0xff]));
  try { symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) { t.skip('Platform does not permit symlink creation.'); return; } throw error; }
  writeFileSync(join(root, 'README.md'), '[linked](linked/private.md#secret)');
  const report = audit(root);
  assert.equal(report.summary.skippedSymlinks, 1);
  assert.equal(report.checks[0].code, 'SYMLINK_TARGET');
});
test('ignored directories stay unread and uncertain/non-Markdown fragments are warnings', t => {
  const { root } = fixture(t);
  mkdirSync(join(root, 'node_modules')); mkdirSync(join(root, '.private'));
  writeFileSync(join(root, 'node_modules/invalid.md'), Buffer.from([0xff]));
  writeFileSync(join(root, '.private/invalid.md'), Buffer.from([0xff]));
  writeFileSync(join(root, 'README.md'), '# A &amp; B\n[uncertain](#unknown) [binary](image.png#part)');
  writeFileSync(join(root, 'image.png'), 'synthetic binary placeholder');
  const report = audit(root);
  assert.equal(report.summary.documents, 1);
  assert.equal(report.summary.warnings, 2);
  assert.equal(report.summary.errors, 0);
});
test('HTML escapes hostile target names and contains no active assets', t => {
  const { root } = fixture(t);
  writeFileSync(join(root, 'README.md'), '[unsafe](%3Cimg%20src=x%20onerror=alert%281%29%3E.md)');
  const html = render(audit(root), 'html');
  assert.ok(html.includes('&lt;img'));
  assert.doesNotMatch(html, /<img|<script|<iframe/);
  assert.ok(html.includes("default-src 'none'"));
});
