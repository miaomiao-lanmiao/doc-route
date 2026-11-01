# Doc Route specification

Version: 0.1.0. Date: 2026-11-01 (Asia/Shanghai).

## Purpose

Maintainers need to catch broken documentation navigation before a release.
Doc Route is an offline Markdown link checker for an explicitly supplied project
directory. It checks local file/directory targets, portable filename casing and
common heading/custom-anchor fragments, without fetching remote URLs or running
repository code. TypeScript + Node.js 22+, zero runtime dependencies.

## Interface

`docroute check ROOT [--format markdown|json|html] [--output NEW_FILE]
[--fail-on error|warning|none]`. Default format is Markdown; default gate is error.
Exit 0: completed without crossing the gate; 1: input/runtime failure; 2: a
completed report crosses the gate. Exclusive output creation, no source edits.

## Supported Markdown

- Inline links/images with balanced labels/targets, angle destinations and
  optional single-line quoted titles; reference, collapsed and defined shortcut links.
- Forward reference definitions; unresolved explicit references are errors.
- Ignore fenced code, indented code, inline code and HTML comments.
- ATX/Setext headings, common inline formatting and duplicate heading suffixes.
  Explicit `<a id="...">` / `<a name="...">` anchors with that attribute first.
- Heading slugs follow a documented conservative subset of GitHub rules. Complex
  HTML/entities in headings produce an uncertain-fragment warning, not a proven
  missing-anchor error. This is not a full CommonMark/MDX or site-generator parser.
- Fragments in non-Markdown targets are left unverified. Remote, protocol-relative
  and other URI schemes are inventoried by category only and never fetched.

## Filesystem and privacy

Only `.md` / `.markdown` files are read. Ignore hidden directories except `.github`,
and common build/dependency/report directories. Skip symlinks/junctions; do not
follow a link target through symlink components or outside the selected root.
Resolve `/path` under the project root and other paths relative to their source.
Reject backslashes, drive/UNC paths and decoded control characters in local links.
Check exact filename case on every platform. This is not a filesystem sandbox
against malicious concurrent modifications; trust the local runtime/filesystem.

Bounds: 10000 directory entries, 1000 Markdown files, 2 MiB per document, 32 MiB
total read bytes, 20000 links, 100000 lines/10000 anchors per document,
64 KiB per source line. Deterministic output.
Reports contain relative source/target paths, fragments, line numbers and finding
codes, never source paragraphs, absolute root paths, remote URLs or URL queries.
These names can still be sensitive and require review before sharing.

## Acceptance criteria

1. Unit tests cover supported Markdown links, ignored code/comments, heading and
   reference behavior, missing paths/anchors and deterministic finding order.
2. Real filesystem tests cover spaces/Unicode, URL encoding, case mismatch,
   outside-root paths and symlinks without reading external targets.
3. CLI smoke tests cover formats, gates, output/input protection, bad encoding
   and limits. HTML has escaped text, no active content/remote assets and a CSP.
4. Tests/build/static checks/offline installed-package smoke pass. Three-platform
   CI verifies the tagged commit. Audit existing owned project docs as a real example.
5. Spec-first history, bilingual README, MIT, examples, review/contribution/security
   guidance, issue forms, maintenance plan, public repository and release draft.
