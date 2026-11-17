import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = 'frames8';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);

const t0 = Date.now();
const sec = () => (Date.now() - t0) / 1000;
const say = (m) => console.log(sec().toFixed(1) + 's', m);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-GB' });
const page = await ctx.newPage();
const events = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('ack ')) { events.push({ got: t.split(' ')[1], receipt: t.split(' ')[3], at: sec() }); say('receipt ' + t.split(' ').slice(1, 3).join(' ')); }
});
const shot = () => page.screenshot({ path: `${outDir}/f${String(fs.readdirSync(outDir).length).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 }).catch(() => {});
setInterval(shot, 300);

await page.goto(base);
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
say('open-board: incidents visible, build ' + await page.locator('[data-testid="build-sha"]').textContent());

await page.waitForTimeout(3000);

// pick the top row, open its panel
const row = page.locator('[data-testid="incident-row"]').first();
const id = await row.getAttribute('data-id');
say('clicking row ' + id);
await row.click();
await page.waitForSelector('[data-testid="incident-panel"]');
const panelId = await page.locator('[data-testid="incident-panel"]').getAttribute('data-id');
say('panel open for ' + panelId + (panelId === id ? ' (matches the row)' : ' (MISMATCH)'));
await page.waitForTimeout(1500);

const before = events.length;
await page.locator('[data-testid="panel-ack"]').click();
say('clicked panel-ack');
await page.waitForSelector('[data-testid="incident-panel"] [data-testid="acked"]', { timeout: 15000 });
say('panel shows acked; receipt in hand');
await page.waitForTimeout(5000);
say('panel still open after refreshes: ' + (await page.locator('[data-testid="incident-panel"]').count()));
await page.waitForTimeout(3000);

await shot();
await ctx.close();
await browser.close();
console.log('frames:', fs.readdirSync(outDir).length, 'events:', JSON.stringify(events));
