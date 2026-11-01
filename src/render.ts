import type { Report } from './audit.js';

const clean = (value: string): string => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' ');
const html = (value: string): string => clean(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const md = (value: string): string => html(value).replace(/([\\`*_{}\[\]()#+.!|~-])/g, '\\$1');

export function render(report: Report, format: 'markdown' | 'json' | 'html'): string {
  if (format === 'json') return `${JSON.stringify(report, null, 2)}\n`;
  const summary = report.summary;
  const findings = report.checks.filter(check => check.status === 'error' || check.status === 'warning');
  if (format === 'html') {
    const rows = findings.map(check => `<tr><td><code>${html(check.source)}:${check.line}</code></td><td><span class="${check.status}">${check.status}</span></td><td><code>${html(check.target)}</code></td><td><strong>${check.code}</strong><p>${html(check.message)}</p></td></tr>`).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Doc Route report</title><style>
:root{font:16px/1.6 system-ui,sans-serif;color:#302a40;background:#f4f1f8}*{box-sizing:border-box}body{max-width:1100px;margin:auto;padding:40px 24px}.eyebrow{font-size:.75rem;font-weight:750;letter-spacing:.16em;color:#78608d}h1{font-size:clamp(2rem,5vw,3.3rem);letter-spacing:-.045em;margin:8px 0}.intro{color:#6b6278}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}.metric{background:white;border:1px solid #e4ddeb;border-radius:14px;padding:18px}.number{font-size:2rem;font-weight:750;display:block}.caption,footer{color:#786d84;font-size:.8rem}.notice{background:#ebe4f2;border-left:4px solid #a78ac1;padding:14px 18px}.panel{margin-top:24px;background:white;border:1px solid #e4ddeb;border-radius:14px;overflow:hidden}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.85rem}th{text-align:left;background:#faf8fc;color:#786d84;text-transform:uppercase;font-size:.7rem;letter-spacing:.05em}td,th{padding:15px;border-bottom:1px solid #eee9f3;vertical-align:top}td p{margin:4px 0;color:#786d84}code{font-family:ui-monospace,monospace;overflow-wrap:anywhere}.error,.warning{border-radius:5px;padding:3px 8px;font-size:.75rem}.error{background:#fbe3e0;color:#943d33}.warning{background:#fff0ce;color:#7b5916}.success{padding:24px;color:#336748}footer{margin-top:24px}@media(max-width:600px){body{padding:24px 16px}.metrics{grid-template-columns:repeat(2,1fr);gap:10px}table{min-width:650px}}
</style></head><body><p class="eyebrow">DOC ROUTE · ${report.toolVersion} · OFFLINE REVIEW</p><h1>Keep documentation connected.</h1><p class="intro">Local paths, portable filename casing and Markdown fragments. External URLs are counted without being opened.</p><div class="metrics"><div class="metric"><span class="number">${summary.documents}</span><span class="caption">Documents</span></div><div class="metric"><span class="number">${summary.links}</span><span class="caption">Link occurrences</span></div><div class="metric"><span class="number">${summary.errors}</span><span class="caption">Errors</span></div><div class="metric"><span class="number">${summary.warnings}</span><span class="caption">Warnings</span></div></div><p class="notice">${html(report.notice)}</p><div class="panel">${rows ? `<div class="scroll"><table><thead><tr><th>Source</th><th>Status</th><th>Target</th><th>Finding</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="success">All checked local links resolved.</p>'}</div><footer>${summary.valid} local links resolved · ${summary.external} external URIs skipped · ${summary.skippedSymlinks} symlinks skipped · No scripts or external assets</footer></body></html>\n`;
  }
  const lines = ['# Doc Route report', '', `${summary.documents} documents · ${summary.links} links · ${summary.errors} errors · ${summary.warnings} warnings`, '', report.notice, '', `Valid local links: ${summary.valid}; external URIs skipped: ${summary.external}.`, ''];
  if (!findings.length) lines.push('All checked local links resolved.', '');
  else {
    lines.push('| Source | Status | Target | Finding |', '| --- | --- | --- | --- |');
    for (const check of findings) lines.push(`| ${md(check.source)}:${check.line} | ${check.status} | ${md(check.target)} | ${check.code}: ${md(check.message)} |`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
