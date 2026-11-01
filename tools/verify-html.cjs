const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.DOCROUTE_PLAYWRIGHT_PATH || 'playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, chromiumSandbox: true });
  try {
    const context = await browser.newContext({ acceptDownloads: false, permissions: [], serviceWorkers: 'block', viewport: { width: 1280, height: 960 } });
    const external = []; const errors = [];
    await context.route('**/*', route => {
      if (new URL(route.request().url()).protocol === 'file:') return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'examples/report.html')).href);
    assert.equal(await page.locator('tbody tr').count(), 3);
    assert.equal(await page.locator('script,img,iframe,form,input').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('example.invalid'));
    fs.mkdirSync(path.join(root, 'reports'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'reports/desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(root, 'reports/mobile.png'), fullPage: true });
    assert.deepEqual(external, []); assert.deepEqual(errors, []);
    console.log('HTML passed desktop/mobile Edge checks: three findings, no active/external content or page overflow.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
