import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const sources = readdirSync('src').filter(name => name.endsWith('.ts'));
const forbidden = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/,
  /['"](?:node:)?(?:child_process|http|https|net|tls|dns|dgram)['"]/, /process\.env/, /shell\s*:\s*true/];
for (const file of sources) {
  const source = readFileSync(join('src', file), 'utf8');
  for (const pattern of forbidden) assert.equal(pattern.test(source), false, `${file}: forbidden runtime behavior`);
}
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
for (const pin of Object.values(manifest.devDependencies)) assert.match(pin, /^\d+\.\d+\.\d+$/);
for (const [name, entry] of Object.entries(JSON.parse(readFileSync('package-lock.json', 'utf8')).packages)) {
  if (!name) continue;
  assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/'));
  assert.ok(entry.integrity);
  assert.ok(!entry.hasInstallScript);
}
console.log(`Static checks passed for ${sources.length} runtime modules and locked dependencies. This is not a security guarantee.`);
