# Verification record

Date: 2026-11-01 (Asia/Shanghai). Local environment: Windows, Node.js v24.18.0.

- 27 tests pass: parser behavior, real filesystem resolution, casing, symlink/
  junction handling, outside-root paths, report escaping and CLI smoke cases.
- Strict TypeScript build passes. Static and offline package checks are required
  before delivery; the same gates run on Linux/Windows/macOS CI.
- A real local audit of the six pre-existing owned source checkouts examined
  66 Markdown documents and 82 recognized links: 46 local links resolved,
  36 external URIs were skipped, no errors/warnings in the supported subset.
- Those results do not prove all rendered routes or external URLs work. No
  repository code, external URLs or private configuration was executed/read.

Local audit outputs and browser screenshots remain ignored under reports/.
Consult the Actions page for the hosted release-head result.
