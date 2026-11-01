#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { audit } from './audit.js';
import { InputError } from './errors.js';
import { render } from './render.js';
import { VERSION } from './version.js';

const help = `Doc Route — offline Markdown navigation checks

Usage: docroute check ROOT [--format markdown|json|html] [--output NEW_FILE]
                          [--fail-on error|warning|none]
ROOT is an explicit local project directory. No remote URL is fetched.
Checks local targets, filename case and a documented heading-anchor subset.
Default format: markdown; threshold: error. Output files must be new.
Exit 0: completed below threshold; 1: input/runtime failure; 2: findings crossed gate.
Use separate option arguments. --help and --version do not read projects.
`;
process.stdout.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EPIPE') process.exit(0);
  process.stderr.write('docroute: Cannot write output.\n'); process.exit(1);
});
try {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--help')) process.stdout.write(help);
  else if (args.length === 1 && args[0] === '--version') process.stdout.write(`${VERSION}\n`);
  else {
    const root = args[1];
    if (args[0] !== 'check' || !root || root.startsWith('-') || /[\x00-\x1f\x7f]/.test(root)) throw new InputError('Expected check ROOT. Use --help for usage.');
    const flags = new Map<string, string>();
    for (let index = 2; index < args.length; index += 2) {
      const flag = args[index]!;
      const value = args[index + 1];
      if (!['--format', '--output', '--fail-on'].includes(flag) || flags.has(flag)) throw new InputError('Unknown or duplicate option.');
      if (!value || value.startsWith('--') || /[\x00-\x1f\x7f]/.test(value)) throw new InputError('Option requires a nonempty value without controls.');
      flags.set(flag, value);
    }
    const format = flags.get('--format') ?? 'markdown';
    const threshold = flags.get('--fail-on') ?? 'error';
    if (format !== 'markdown' && format !== 'json' && format !== 'html') throw new InputError('Unsupported output format.');
    if (threshold !== 'error' && threshold !== 'warning' && threshold !== 'none') throw new InputError('Unsupported finding threshold.');
    const report = audit(root);
    const content = render(report, format);
    const output = flags.get('--output');
    if (output === undefined) process.stdout.write(content);
    else {
      try { writeFileSync(output, content, { flag: 'wx', encoding: 'utf8', mode: 0o600 }); }
      catch { throw new InputError('Cannot create output file. It may exist already or its parent may be missing.'); }
    }
    if (threshold !== 'none' && (report.summary.errors > 0 || threshold === 'warning' && report.summary.warnings > 0)) process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`docroute: ${error instanceof InputError ? error.message : 'Operation failed. Check project permissions and file state.'}\n`);
  process.exitCode = 1;
}
