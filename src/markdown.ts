import { InputError } from './errors.js';

export interface Link { line: number; destination: string }
export interface Markdown { links: Link[]; anchors: Set<string>; uncertainAnchors: boolean; referenceWarnings: number[]; unresolved: number[] }
const blank = (text: string): string => text.replace(/[^\r\n]/g, ' ');
const reference = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();
const escaped = (text: string, position: number): boolean => {
  let count = 0;
  while (position > 0 && text[--position] === '\\') count++;
  return count % 2 === 1;
};

function hideInlineCode(text: string): string {
  // Work with UTF-16 indices so masking preserves positions in the source line.
  const masked = text.split('');
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '`' || escaped(text, index)) continue;
    let width = 1;
    while (text[index + width] === '`') width++;
    let end = index + width;
    while (end < text.length) {
      const candidate = text.indexOf('`', end);
      if (candidate < 0) { end = -1; break; }
      let run = 1;
      while (text[candidate + run] === '`') run++;
      if (run === width) { end = candidate + run; break; }
      end = candidate + run;
    }
    if (end > 0 && end <= text.length && text.slice(end - width, end) === '`'.repeat(width)) {
      for (let position = index; position < end; position++) masked[position] = ' ';
      index = end - 1;
    } else index += width - 1;
  }
  return masked.join('');
}

function destination(text: string, start: number, inline: boolean): { value: string; end: number } | null {
  let position = start;
  while (text[position] === ' ' || text[position] === '\t') position++;
  let value = '';
  if (text[position] === '<') {
    const end = text.indexOf('>', position + 1);
    if (end < 0) return null;
    value = text.slice(position + 1, end); position = end + 1;
  } else {
    let depth = 0;
    while (position < text.length) {
      const character = text[position]!;
      if (character === '\\' && position + 1 < text.length) { value += text.slice(position, position + 2); position += 2; continue; }
      if (character === ')' && depth === 0) break;
      if (/\s/.test(character) && depth === 0) break;
      if (character === '(') { if (++depth > 32) return null; }
      if (character === ')') depth--;
      value += character; position++;
    }
    if (depth !== 0) return null;
  }
  while (/\s/.test(text[position] ?? '') && position < text.length) position++;
  if (text[position] === '"' || text[position] === "'") {
    const quote = text[position++]!;
    while (position < text.length && (text[position] !== quote || escaped(text, position))) position++;
    if (position >= text.length) return null;
    position++;
    while (/\s/.test(text[position] ?? '') && position < text.length) position++;
  }
  if (inline ? text[position] !== ')' : position !== text.length) return null;
  return { value: value.replace(/\\([\\()[\]<> ])/g, '$1'), end: inline ? position + 1 : position };
}

export function scanMarkdown(input: string): Markdown {
  if (Buffer.byteLength(input) > 2 * 1024 * 1024) throw new InputError('Markdown document exceeds 2 MiB.');
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  let lines = text.split('\n');
  if (lines.length > 100000) throw new InputError('Markdown document exceeds 100000 lines.');
  let fence: { character: string; width: number } | undefined;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (Buffer.byteLength(line) > 65536) throw new InputError('Markdown line exceeds 64 KiB.');
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      lines[index] = blank(line);
      if (marker && marker[1]![0] === fence.character && marker[1]!.length >= fence.width && !marker[2]!.trim()) fence = undefined;
    } else if (marker) {
      fence = { character: marker[1]![0]!, width: marker[1]!.length }; lines[index] = blank(line);
    } else if (/^(?: {4}|\t)/.test(line)) lines[index] = blank(line);
  }
  lines = lines.join('\n').replace(/<!--[\s\S]*?(?:-->|$)/g, blank).split('\n');
  const anchors = new Set<string>();
  const headingNames = new Set<string>();
  const headingCounts = new Map<string, number>();
  let uncertainAnchors = false;
  function addHeading(value: string): void {
    if (/&(?:#\w+|[a-z]+);|<[^>]+>/i.test(value)) uncertainAnchors = true;
    const plain = value.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
      .replace(/_{1,2}([^_\r\n]+)_{1,2}/g, (match: string, content: string, offset: number, whole: string) => {
        return /[\p{L}\p{N}_]/u.test(whole[offset - 1] ?? '') || /[\p{L}\p{N}_]/u.test(whole[offset + match.length] ?? '') ? match : content;
      }).trim().toLowerCase();
    if (plain.startsWith('_') && plain.endsWith('_')) uncertainAnchors = true;
    const base = plain.replace(/ /g, '-').replace(/[^\p{L}\p{N}\p{M}_-]/gu, '');
    let suffix = headingCounts.get(base) ?? 0;
    let name = suffix === 0 ? base : `${base}-${suffix}`;
    while (headingNames.has(name)) name = `${base}-${++suffix}`;
    headingCounts.set(base, suffix + 1);
    headingNames.add(name);
    anchors.add(name);
    if (anchors.size > 10000) throw new InputError('Markdown document exceeds 10000 anchors.');
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const heading = /^ {0,3}#{1,6}[ \t]+(.+)$/.exec(line);
    if (heading) addHeading(heading[1]!.replace(/\s+#+\s*$/, ''));
    else if (/^ {0,3}(?:=+|-+)\s*$/.test(line) && index > 0 && lines[index - 1]!.trim()) addHeading(lines[index - 1]!);
    for (const match of hideInlineCode(line).matchAll(/<a\s+(?:id|name)\s*=\s*["']([^"'<>\r\n]+)["'][^>]{0,1024}>/gi)) {
      anchors.add(match[1]!);
      if (match[1]!.includes('&')) uncertainAnchors = true;
    }
    if (anchors.size > 10000) throw new InputError('Markdown document exceeds 10000 anchors.');
  }
  const definitions = new Map<string, string>();
  const definitionLines = new Set<number>();
  const referenceWarnings: number[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = /^ {0,3}\[([^\]]+)\]:\s*(.*)$/.exec(lines[index]!);
    if (!match) continue;
    const parsed = destination(match[2]!, 0, false);
    if (!parsed) continue;
    const id = reference(match[1]!);
    if (definitions.has(id)) referenceWarnings.push(index + 1);
    else definitions.set(id, parsed.value);
    definitionLines.add(index);
  }
  const links: Link[] = [];
  const unresolved: number[] = [];
  function readLinks(line: string, number: number, nesting = 0): void {
    if (nesting > 32) return;
    for (let index = 0; index < line.length; index++) {
      if (line[index] !== '[' || escaped(line, index)) continue;
      let end = index + 1; let depth = 1;
      while (end < line.length && depth) {
        if (!escaped(line, end)) {
          if (line[end] === '[') depth++;
          if (line[end] === ']') depth--;
        }
        if (depth > 32) break;
        end++;
      }
      if (depth) break;
      const label = line.slice(index + 1, end - 1);
      if (label.includes('[')) readLinks(label, number, nesting + 1);
      let target: string | undefined;
      if (line[end] === '(') {
        const parsed = destination(line, end + 1, true);
        if (parsed) { target = parsed.value; end = parsed.end; }
      } else if (line[end] === '[') {
        const close = line.indexOf(']', end + 1);
        if (close >= 0) {
          target = definitions.get(reference(line.slice(end + 1, close) || label));
          if (target === undefined) {
            unresolved.push(number);
            if (links.length + unresolved.length > 20000) throw new InputError('Markdown link count exceeds 20000.');
          }
          end = close + 1;
        }
      } else target = definitions.get(reference(label));
      if (target !== undefined) links.push({ line: number, destination: target });
      if (links.length > 20000) throw new InputError('Markdown link count exceeds 20000.');
      index = end - 1;
    }
  }
  for (let index = 0; index < lines.length; index++) if (!definitionLines.has(index)) readLinks(hideInlineCode(lines[index]!), index + 1);
  return { links, anchors, uncertainAnchors, referenceWarnings, unresolved };
}
