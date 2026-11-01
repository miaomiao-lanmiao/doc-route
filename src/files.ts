import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync, type Dirent, type Stats } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { InputError } from './errors.js';

export const markdownFile = (path: string): boolean => /\.(?:md|markdown)$/i.test(path);
const ignored = new Set(['node_modules', 'dist', 'build', 'coverage', 'reports', 'release-artifacts', 'venv']);
export const inside = (root: string, path: string): boolean => {
  const name = relative(root, path);
  return name === '' || (!isAbsolute(name) && name !== '..' && !name.startsWith(`..${sep}`));
};

export class Project {
  readonly root: string;
  readonly documents: string[] = [];
  skippedDirectories = 0;
  skippedSymlinks = 0;
  private visited = 0;
  private bytes = 0;
  private directories = new Map<string, Dirent[]>();

  constructor(path: string) {
    if (/^(?:\\\\|\/\/)/.test(path)) throw new InputError('Use a local project directory.');
    try {
      this.root = realpathSync(resolve(path));
      if (!lstatSync(this.root).isDirectory()) throw new Error();
    } catch { throw new InputError('Cannot open the project directory.'); }
    this.walk(this.root);
  }

  private entries(path: string): Dirent[] {
    const cached = this.directories.get(path);
    if (cached) return cached;
    const entries: Dirent[] = [];
    let directory;
    try { directory = opendirSync(path); }
    catch { throw new InputError('Cannot enumerate a project directory.'); }
    try {
      while (true) {
        const entry = directory.readSync();
        if (!entry) break;
        if (++this.visited > 10000) throw new InputError('Project exceeds the 10000-entry limit.');
        entries.push(entry);
      }
    } finally { directory.closeSync(); }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    this.directories.set(path, entries);
    return entries;
  }

  private walk(path: string): void {
    for (const entry of this.entries(path)) {
      const absolute = join(path, entry.name);
      if (entry.isSymbolicLink()) { this.skippedSymlinks++; continue; }
      if (entry.isDirectory()) {
        if ((entry.name.startsWith('.') && entry.name !== '.github') || ignored.has(entry.name)) this.skippedDirectories++;
        else this.walk(absolute);
      } else if (entry.isFile() && markdownFile(entry.name)) {
        this.documents.push(absolute);
        if (this.documents.length > 1000) throw new InputError('Project exceeds 1000 Markdown files.');
      }
    }
  }

  locate(path: string): { kind: 'valid'; stats: Stats } | { kind: 'missing' | 'case' | 'symlink' | 'outside' } {
    if (!inside(this.root, path)) return { kind: 'outside' };
    let current = this.root;
    let stats = lstatSync(current);
    for (const part of relative(this.root, path).split(sep).filter(Boolean)) {
      if (!stats.isDirectory()) return { kind: 'missing' };
      const entries = this.entries(current);
      const match = entries.find(entry => entry.name === part);
      if (!match) return { kind: entries.some(entry => entry.name.toLowerCase() === part.toLowerCase()) ? 'case' : 'missing' };
      current = join(current, part);
      try { stats = lstatSync(current); }
      catch { return { kind: 'missing' }; }
      if (stats.isSymbolicLink()) return { kind: 'symlink' };
    }
    return { kind: 'valid', stats };
  }

  read(path: string): string {
    let descriptor: number;
    try { descriptor = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0)); }
    catch { throw new InputError('Cannot open a Markdown document.'); }
    try {
      const stats = fstatSync(descriptor);
      if (!stats.isFile() || stats.size > 2 * 1024 * 1024) throw new InputError('Markdown input must be a regular file no larger than 2 MiB.');
      const chunks: Buffer[] = [];
      const buffer = Buffer.alloc(65536);
      let size = 0;
      while (true) {
        const count = readSync(descriptor, buffer, 0, buffer.length, null);
        if (!count) break;
        size += count; this.bytes += count;
        if (size > 2 * 1024 * 1024 || this.bytes > 32 * 1024 * 1024) throw new InputError('Markdown byte limit exceeded.');
        chunks.push(Buffer.from(buffer.subarray(0, count)));
      }
      try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
      catch { throw new InputError('Markdown input must be valid UTF-8.'); }
    } finally { closeSync(descriptor); }
  }
}
