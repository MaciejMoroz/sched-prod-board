import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = 'frames';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);

const t0 = Date.now();
const now = () => ((Date.now() - t0) / 1000).toFixed(1);
const log = [];
const say = (m) => { log.push(`${now()}s ${m}`); console.log(now() + 's', m); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-GB' });
const page = await ctx.newPage();
const receipts = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('ack ')) { receipts.push(t); say('receipt ' + t); }
});

const shot = async () => page.screenshot({ path: `${outDir}/f${String(fs.readdirSync(outDir).length).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 });

const loop = setInterval(shot, 250);

// open-board: loader then incidents
await page.goto(base);
await page.waitForSelector('[data-testid="loader"]', { timeout: 3000 }).catch(() => say('loader not seen'));
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
say('open-board: incidents visible, first time=' + await page.locator('[data-testid="incident-row"] time').first().textContent());
say('build-sha: ' + await page.locator('[data-testid="build-sha"]').textContent());
await page.waitForTimeout(1500);

// watch-board: leave open, refresh ticks
say('watch-board: leaving board open');
await page.waitForTimeout(8000);
say('rows after refresh: ' + await page.locator('[data-testid="incident-row"]').count());

// ack-incident
const firstRow = page.locator('[data-testid="incident-row"]').first();
const id = await firstRow.getAttribute('data-id');
say('ack-incident: acking ' + id);
await firstRow.locator('[data-testid="ack"]').click();
await page.waitForSelector('[data-testid="acked"]', { timeout: 15000 });
say('acked visible for ' + id);
await page.waitForTimeout(2500);

clearInterval(loop);
await shot();
await ctx.close();
await browser.close();
fs.writeFileSync('capture-log.txt', log.join('\n') + '\n');
console.log('frames:', fs.readdirSync(outDir).length);
