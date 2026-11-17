import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = process.env.OUT_DIR || 'frames7';
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
  if (t.startsWith('ack ')) events.push({ got: t.split(' ')[1], receipt: t.split(' ')[3], at: sec() });
});

let shooting = true;
const shotLoop = async () => {
  while (shooting) {
    await page.screenshot({ path: `${outDir}/f${String(fs.readdirSync(outDir).length).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 250));
  }
};
shotLoop();

await page.goto(base);
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
say('board open');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const attempts = [];
let mismatch = null;

for (let i = 0; i < 80 && !mismatch; i++) {
  const rows = page.locator('[data-testid="incident-row"]');
  const n = await rows.count();
  if (n < 2) { await sleep(2000); continue; }
  const topBtn = rows.nth(0).locator('[data-testid="ack"]');
  const targetBtn = rows.nth(1).locator('[data-testid="ack"]');
  if (!(await topBtn.count()) || !(await targetBtn.count())) { await sleep(1500); continue; }
  const intended = await rows.nth(1).getAttribute('data-id');
  const box = await targetBtn.boundingBox().catch(() => null);
  if (!box) continue;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  const top0 = await rows.nth(0).getAttribute('data-id');
  let shifted = false;
  for (let w = 0; w < 60 && !shifted; w++) {
    await sleep(100);
    const topNow = await rows.nth(0).getAttribute('data-id');
    if (topNow !== top0) shifted = true;
  }
  const before = events.length;
  await page.mouse.down();
  await sleep(70 + Math.random() * 60);
  await page.mouse.up();
  await sleep(700);
  const ev = events[before];
  attempts.push({ intended, shifted, got: ev ? ev.got : null, at: sec() });
  say('meant ' + intended + (shifted ? ' (list shifted mid-reach)' : '') + ' — got ' + (ev ? ev.got : 'nothing'));
  if (ev && ev.got !== intended) mismatch = { intended, got: ev.got, receipt: ev.receipt, at: sec() };
  await sleep(300);
}

shooting = false;
await sleep(500);
await ctx.close();
await browser.close();
fs.writeFileSync('race-mismatch.json', JSON.stringify({ attempts, mismatch }, null, 2));
console.log('mismatch:', JSON.stringify(mismatch));
console.log('frames:', fs.readdirSync(outDir).length);
