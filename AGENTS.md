# Working on Doc Route

Read `docs/spec.md`. Keep Node.js 22+, strict TypeScript and zero runtime npm
dependencies. Runtime must not contact URLs, start subprocesses, execute project
code or edit source docs. Scan only an explicit local root and keep resource caps.

Do not follow nested symlinks/junctions or outside-root paths. Check filename case
on all platforms. Do not use actual private repositories, secrets or home config
for tests. Reports must omit absolute roots, URL queries, remote URLs and source
paragraphs; escape display text and preserve the HTML CSP.

Keep Markdown limitations explicit. Uncertain fragments are warnings, not asserted
missing anchors. Avoid claiming complete CommonMark or site-generator compatibility.
For behavior changes, add focused regression tests and run `npm test`, build,
security/package checks and `git diff --check`. Confirm the source quickstart from
a clean install. Generated examples use temporary synthetic sites only.

The user requested a new project and GitHub delivery. Create a public repository,
push focused commits, verify all three hosted CI jobs at HEAD, create an annotated
version tag and keep the initial release as a draft. Do not publish to npm, move
pushed tags, or commit actual user documentation reports/screenshots. Future
releases require an update/release request and synchronized versions/notes.
