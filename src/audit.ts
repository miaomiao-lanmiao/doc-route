import { dirname, relative, resolve, sep } from 'node:path';
import { Project, inside, markdownFile } from './files.js';
import { scanMarkdown, type Markdown } from './markdown.js';
import { InputError } from './errors.js';
import { VERSION } from './version.js';

export interface Check { source: string; line: number; target: string; status: 'valid' | 'external' | 'error' | 'warning'; code: string; message: string }
export interface Report {
  schemaVersion: 1; toolVersion: typeof VERSION;
  summary: { documents: number; links: number; valid: number; external: number; errors: number; warnings: number; skippedDirectories: number; skippedSymlinks: number };
  checks: Check[]; notice: string;
}
const portable = (value: string): string => value.split(sep).join('/');

export function audit(root: string): Report {
  const project = new Project(root);
  const documents = new Map<string, Markdown>();
  for (const path of project.documents) documents.set(path, scanMarkdown(project.read(path)));
  const checks: Check[] = [];
  let linkCount = 0;
  for (const [source, document] of documents) {
    const name = portable(relative(project.root, source));
    const add = (line: number, target: string, status: Check['status'], code: string, message: string): void => {
      checks.push({ source: name, line, target, status, code, message });
    };
    for (const line of document.referenceWarnings) add(line, '(reference definition)', 'warning', 'DUPLICATE_REFERENCE', 'The first reference definition is used.');
    for (const line of document.unresolved) {
      if (++linkCount > 20000) throw new InputError('Project exceeds 20000 links.');
      add(line, '(reference)', 'error', 'UNRESOLVED_REFERENCE', 'Explicit reference definition was not found.');
    }
    for (const link of document.links) {
      if (++linkCount > 20000) throw new InputError('Project exceeds 20000 links.');
      const raw = link.destination;
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z]:/i.test(raw) || raw.startsWith('//')) {
        add(link.line, '(external URI)', 'external', 'EXTERNAL_SKIPPED', 'URI was not fetched.'); continue;
      }
      const hash = raw.indexOf('#');
      let path: string; let fragment: string;
      try {
        path = decodeURIComponent((hash < 0 ? raw : raw.slice(0, hash)).split('?', 1)[0]!);
        fragment = hash < 0 ? '' : decodeURIComponent(raw.slice(hash + 1));
      } catch { add(link.line, '(invalid local target)', 'error', 'INVALID_TARGET', 'Target contains invalid URL encoding.'); continue; }
      if (/[\\:\x00-\x1f\x7f]/.test(path) || path.startsWith('//') || /[\x00-\x1f\x7f]/.test(fragment)) {
        add(link.line, '(invalid local target)', 'error', 'INVALID_TARGET', 'Use a portable local path without drive letters, backslashes or controls.'); continue;
      }
      const absolute = path === '' ? source : path.startsWith('/') ? resolve(project.root, path.replace(/^\/+/, '')) : resolve(dirname(source), path);
      if (!inside(project.root, absolute)) { add(link.line, '(outside project)', 'error', 'OUTSIDE_ROOT', 'Target escapes the selected project root.'); continue; }
      const target = (portable(relative(project.root, absolute)) || '.') + (fragment ? `#${fragment}` : '');
      const located = project.locate(absolute);
      if (located.kind === 'case') add(link.line, target, 'error', 'CASE_MISMATCH', 'Target filename case differs from the filesystem entry.');
      else if (located.kind === 'missing') add(link.line, target, 'error', 'MISSING_TARGET', 'Local target does not exist.');
      else if (located.kind === 'symlink') add(link.line, target, 'warning', 'SYMLINK_TARGET', 'Target passes through a skipped symlink or junction.');
      else if (located.kind === 'outside') add(link.line, '(outside project)', 'error', 'OUTSIDE_ROOT', 'Target escapes the selected project root.');
      else if (fragment) {
        const destination = documents.get(absolute);
        if (!markdownFile(absolute) || !destination) add(link.line, target, 'warning', 'FRAGMENT_UNVERIFIED', 'Fragment target is not a scanned Markdown document.');
        else if (destination.anchors.has(fragment)) add(link.line, target, 'valid', 'OK', 'Local target and fragment resolved.');
        else if (destination.uncertainAnchors) add(link.line, target, 'warning', 'FRAGMENT_UNCERTAIN', 'Complex headings prevent a conclusive fragment check.');
        else add(link.line, target, 'error', 'MISSING_ANCHOR', 'Fragment does not match a recognized heading or custom anchor.');
      } else add(link.line, target, 'valid', 'OK', 'Local target exists.');
    }
  }
  checks.sort((a, b) => (a.source < b.source ? -1 : a.source > b.source ? 1 : 0) || a.line - b.line || (a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  const summary = { documents: documents.size, links: linkCount, valid: 0, external: 0, errors: 0, warnings: 0, skippedDirectories: project.skippedDirectories, skippedSymlinks: project.skippedSymlinks };
  for (const check of checks) {
    if (check.status === 'valid') summary.valid++;
    else if (check.status === 'external') summary.external++;
    else if (check.status === 'error') summary.errors++;
    else summary.warnings++;
  }
  return { schemaVersion: 1, toolVersion: VERSION, summary, checks,
    notice: 'Offline navigation checks for a documented Markdown subset. Remote URLs are not checked. Relative paths and fragments may be sensitive; review reports before sharing. No source text or absolute project root is included.' };
}
