import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audit, render } from '../dist/index.js';

const temporary = mkdtempSync(join(tmpdir(), 'doc route example '));
try {
  writeFileSync(join(temporary, 'README.md'), '# Home\n[Guide](guide.md#install)\n[Missing page](missing.md)\n[Wrong case](Guide.md)\n[Missing anchor](guide.md#unknown)\n[Remote](https://example.invalid)\n');
  writeFileSync(join(temporary, 'guide.md'), '# Install\n[Back](README.md#home)');
  const report = audit(temporary);
  for (const format of ['html', 'markdown']) writeFileSync(new URL(`../examples/report.${format === 'markdown' ? 'md' : format}`, import.meta.url), render(report, format));
  console.log('Generated the synthetic example report without committing broken Markdown inputs.');
} finally { rmSync(temporary, { recursive: true, force: true }); }
