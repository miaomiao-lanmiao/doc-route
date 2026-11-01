# Security policy

The latest 0.1.x source receives fixes. Use private GitHub vulnerability reporting
when available. Otherwise request a private channel without posting secrets or
weaponized examples. Initial acknowledgement target: 7 days.

Doc Route reads only Markdown documents under an explicit project root. It does
not fetch URLs or run repository commands. Nested symlinks/junctions and paths
outside the root are left unfollowed; this is not a sandbox against malicious
concurrent filesystem changes. Trust your installed Node.js and filesystem.

Reports expose paths/fragments even though they omit paragraphs, roots, queries
and external URLs. Review before sharing. The Markdown parser is intentionally
bounded; a clean result does not prove all possible links or rendered routes work.
Static checks and tests provide limited evidence, not a security guarantee.
