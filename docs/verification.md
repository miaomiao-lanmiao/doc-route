# Verification record

## Maintenance 0.1.1

Date: 2026-11-06 (Asia/Shanghai). Local environment: Windows, Node.js v24.18.0.

- 32 tests pass, including parser, filesystem-audit and CLI regressions for
  literal comment markers in inline code. Real comment endings, escaped markers,
  unmatched backtick runs and source line numbers are covered.
- Strict build, static runtime checks and offline installed-package smoke pass.
- Source quickstart is checked after `npm ci --ignore-scripts`; valid sample and
  repository documentation audits complete without findings in the supported subset.
- Hosted CI at the release commit must be checked before tagging. External URLs
  and unsupported Markdown remain outside this verification.

## Initial 0.1.0

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
