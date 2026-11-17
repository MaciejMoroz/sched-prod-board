import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = 'frames2';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir);

const t0 = Date.now();
const sec = () => (Date.now() - t0) / 1000;
const say = (m) => console.log(sec().toFixed(1) + 's', m);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-GB' });
const page = await ctx.newPage();
const receipts = [];
page.on('console', (m) => {
  const t = m.text();
  if (t.startsWith('ack ')) { receipts.push(t); say('receipt ' + t); }
});

const shot = () =>
  page
    .screenshot({ path: `${outDir}/f${String(fs.readdirSync(outDir).length).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 })
    .catch(() => {});
const loop = setInterval(shot, 400);

await page.goto(base);
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
const initial = new Set(await page.locator('[data-testid="incident-row"]').evaluateAll((els) => els.map((e) => e.dataset.id)));
say('open-board: ' + initial.size + ' incidents visible, watching for a landing incident');

// poll DOM for a row that was not there before
const landed = await page
  .waitForFunction(
    (known) => {
      const ids = [...document.querySelectorAll('[data-testid="incident-row"]')].map((e) => e.dataset.id);
      return ids.find((id) => !known.includes(id));
    },
    [...initial],
    { timeout: 600000, polling: 200 },
  )
  .then((h) => h.jsonValue())
  .catch(() => null);

if (!landed) {
  say('no incident landed in 10 minutes');
} else {
  say('landing: new incident ' + landed + ' appeared at the top of the board');
  const row = page.locator(`[data-testid="incident-row"][data-id="${landed}"]`);
  await row.locator('[data-testid="ack"]').click();
  say('ack-incident: clicked ack on ' + landed);
  await page.waitForSelector(`[data-testid="incident-row"][data-id="${landed}"] [data-testid="acked"]`, { timeout: 15000 });
  say('acked visible for ' + landed);
  await page.waitForTimeout(3000);
}

clearInterval(loop);
await shot();
await ctx.close();
await browser.close();
fs.writeFileSync('race-log.txt', receipts.join('\n') + '\n');
console.log('frames:', fs.readdirSync(outDir).length, 'receipts:', receipts.length);
