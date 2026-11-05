import assert from 'node:assert/strict';
import test from 'node:test';
import { scanMarkdown } from '../dist/index.js';

test('inline links, images, angle paths, balanced parentheses and titles', () => {
  const result = scanMarkdown('[doc](docs/readme.md "title") ![image](image.png) [space](<notes with space.md>) [nested](file(one).md) [escaped](file\\(two\\).md)');
  assert.deepEqual(result.links.map(link => link.destination), ['docs/readme.md', 'image.png', 'notes with space.md', 'file(one).md', 'file(two).md']);
});
test('forward, collapsed, shortcut and nested badge links', () => {
  const result = scanMarkdown('[a][target] [target][] [target]\n[![badge](badge.svg)](README.md)\n[target]: docs/target.md\n');
  assert.deepEqual(result.links.map(link => link.destination), ['docs/target.md', 'docs/target.md', 'docs/target.md', 'badge.svg', 'README.md']);
});
test('code fences, inline/indented code and comments are ignored', () => {
  const result = scanMarkdown('`[x](bad1)`\n    [x](bad2)\n```md\n[x](bad3)\n```\n<!-- [x](bad4)\n[x](bad5) -->\n[x](good)');
  assert.deepEqual(result.links, [{ line: 8, destination: 'good' }]);
});
test('comment text inside a fenced example does not hide following real links', () => {
  const result = scanMarkdown('```html\n<!-- unclosed sample\n```\n[real](README.md)');
  assert.equal(result.links[0].destination, 'README.md');
});

test('comment markers inside inline code leave following links and headings visible', () => {
  const result = scanMarkdown('`<!--` [real](README.md)\n``a ` <!--`` [second](guide.md)\n# Visible heading\n[heading](#visible-heading)');
  assert.deepEqual(result.links, [
    { line: 1, destination: 'README.md' },
    { line: 2, destination: 'guide.md' },
    { line: 4, destination: '#visible-heading' },
  ]);
  assert.ok(result.anchors.has('visible-heading'));
});

test('real comments close independently of backticks and do not invent code spans', () => {
  const result = scanMarkdown('<!-- ` [hidden](bad) --> `<!--` [real](good)\n<!-- multi\n` --> [later](later)');
  assert.deepEqual(result.links, [
    { line: 1, destination: 'good' },
    { line: 3, destination: 'later' },
  ]);
});

test('unmatched backtick runs and escaped comment openers remain literal', () => {
  assert.deepEqual(scanMarkdown('`unclosed <!-- [hidden](bad) --> [real](good)').links, [{ line: 1, destination: 'good' }]);
  assert.deepEqual(scanMarkdown('`[literal](good)``').links, [{ line: 1, destination: 'good' }]);
  assert.deepEqual(scanMarkdown('\\<!-- [real](good)').links, [{ line: 1, destination: 'good' }]);
});

test('dense single-line code spans preserve later links after a multiline comment', () => {
  const row = '`x` '.repeat(16000) + '`<!--` [visible](target.md)';
  const input = '<!-- hidden\n` --> ' + Array(16).fill(row).join('\n') + '\n# Visible';
  const result = scanMarkdown(input);
  assert.deepEqual(result.links, Array.from({ length: 16 }, (_, index) => ({ line: index + 2, destination: 'target.md' })));
  assert.ok(result.anchors.has('visible'));
});
test('headings, literal underscores, common emphasis and duplicate suffixes', () => {
  const result = scanMarkdown('# Hello World!\n## Hello World!\n## API_KEY\n## _Helpful Section_\nSetext\n======\n## 中文标题\n');
  for (const anchor of ['hello-world', 'hello-world-1', 'api_key', 'helpful-section', 'setext', '中文标题']) assert.ok(result.anchors.has(anchor), anchor);
});
test('custom anchors do not consume heading suffixes or appear inside code', () => {
  const result = scanMarkdown('<a name="hello"></a>\n# Hello\n# Hello\n`<a id="fake"></a>`\n');
  assert.ok(result.anchors.has('hello-1'));
  assert.ok(!result.anchors.has('hello-2'));
  assert.ok(!result.anchors.has('fake'));
});
test('duplicate reference definitions and unresolved explicit references are visible', () => {
  const result = scanMarkdown('[x][missing]\n[id]: first.md\n[id]: second.md\n[id]');
  assert.deepEqual(result.unresolved, [1]);
  assert.deepEqual(result.referenceWarnings, [3]);
  assert.equal(result.links[0].destination, 'first.md');
});
test('escaped brackets and undefined shortcut text are ordinary text', () => {
  assert.equal(scanMarkdown('\\[literal](missing) [ordinary] [ ] task').links.length, 0);
});
test('complex headings leave fragments uncertain', () => {
  assert.equal(scanMarkdown('# A &amp; B').uncertainAnchors, true);
});
test('parser bounds reject oversized inputs and excessive links', () => {
  assert.throws(() => scanMarkdown('x'.repeat(2 * 1024 * 1024 + 1)), /2 MiB/);
  assert.throws(() => scanMarkdown('x'.repeat(65537)), /64 KiB/);
  assert.throws(() => scanMarkdown('\n'.repeat(100001)), /100000/);
  assert.throws(() => scanMarkdown('[x][unknown]\n'.repeat(20001)), /20000/);
});
