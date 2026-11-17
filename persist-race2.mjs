import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = process.env.OUT_DIR || 'frames5';
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
say('board open, aiming below the top row');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const attempts = [];
let mismatch = null;

// wait for a landing, then during the next hesitations the landing's push will slide rows
for (let i = 0; i < 120 && !mismatch; i++) {
  const unacked = page.locator('[data-testid="ack"]');
  const count = await unacked.count();
  if (count < 2) { await sleep(1500); continue; }
  const btn = unacked.nth(1); // reach for the second unacked row, like a person picking from the top
  const intended = await btn.evaluate((b) => b.closest('[data-testid="incident-row"]').dataset.id);
  const box = await btn.boundingBox().catch(() => null);
  if (!box) continue;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  await sleep(900 + Math.random() * 600); // long enough for a 2s re-render or a landing to slide the rows
  const before = events.length;
  await page.mouse.down();
  await sleep(60 + Math.random() * 80);
  await page.mouse.up();
  await sleep(700);
  const ev = events[before];
  attempts.push({ intended, got: ev ? ev.got : null, at: sec() });
  say('meant ' + intended + ' — got ' + (ev ? ev.got : 'nothing'));
  if (ev && ev.got !== intended) mismatch = { intended, got: ev.got, receipt: ev.receipt, at: sec() };
}

shooting = false;
await sleep(500);
await ctx.close();
await browser.close();
fs.writeFileSync('race-mismatch.json', JSON.stringify({ attempts, mismatch }, null, 2));
console.log('mismatch:', JSON.stringify(mismatch));
console.log('frames:', fs.readdirSync(outDir).length);
