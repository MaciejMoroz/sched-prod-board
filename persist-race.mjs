import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = 'frames4';
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
  if (t.startsWith('ack ')) { events.push({ got: t.split(' ')[1], receipt: t.split(' ')[3], at: sec() }); }
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

// act like a person for as long as it takes: reach for the top unacked row, hesitate, press
for (let i = 0; i < 40 && !mismatch; i++) {
  const unacked = page.locator('[data-testid="ack"]');
  const count = await unacked.count();
  if (!count) { await sleep(2000); continue; }
  const btn = unacked.first();
  const intended = await btn.evaluate((b) => b.closest('[data-testid="incident-row"]').dataset.id);
  const box = await btn.boundingBox().catch(() => null);
  if (!box) continue;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await sleep(300 + Math.random() * 700); // the hesitation a person has
  const eventsBefore = events.length;
  await page.mouse.down();
  await sleep(80 + Math.random() * 80);
  await page.mouse.up();
  await sleep(600);
  const ev = events[eventsBefore];
  attempts.push({ intended, got: ev ? ev.got : null, at: sec() });
  if (!ev) say('meant ' + intended + ' — click did nothing (row re-rendered mid-press)');
  else say('meant ' + intended + ' — got ' + ev.got);
  if (ev && ev.got !== intended) mismatch = { ...attempts[attempts.length - 1], receipt: ev.receipt };
  await sleep(400 + Math.random() * 800);
}

shooting = false;
await sleep(500);
await ctx.close();
await browser.close();
fs.writeFileSync('race-mismatch.json', JSON.stringify({ attempts, mismatch }, null, 2));
console.log('mismatch:', JSON.stringify(mismatch));
console.log('frames:', fs.readdirSync(outDir).length);
