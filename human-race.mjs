import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.env.BASE_URL;
const outDir = 'frames3';
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
  if (t.startsWith('ack ')) { events.push({ got: t.split(' ')[1], at: sec() }); say('receipt ' + t.split(' ').slice(1, 3).join(' ')); }
});

const shot = () =>
  page.screenshot({ path: `${outDir}/f${String(fs.readdirSync(outDir).length).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 80 }).catch(() => {});
setInterval(shot, 300);

await page.goto(base);
await page.waitForSelector('[data-testid="incident-row"][data-testid] , [data-testid="incident-row"]', { timeout: 15000 });
say('board open, acking like a person');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// click like a person: see the row, move the mouse to its Ack, hesitate, press
async function humanAck(pickIndex) {
  const rows = page.locator('[data-testid="incident-row"]');
  const target = rows.nth(pickIndex);
  const id = await target.getAttribute('data-id');
  const btn = target.locator('[data-testid="ack"]');
  if (!(await btn.count())) return { intended: id, skipped: true };
  const box = await btn.boundingBox();
  if (!box) return { intended: id, skipped: true };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 }); // eyes and hand move
  await sleep(500 + Math.random() * 400); // a person hesitates
  await page.mouse.down();
  await sleep(60 + Math.random() * 60); // finger on the button
  await page.mouse.up();
  await sleep(400);
  return { intended: id, clickedAt: sec() };
}

const attempts = [];
const receiptsAt = {};

for (let i = 0; i < 6; i++) {
  // pick the first unacked row like on-call would
  const unacked = page.locator('[data-testid="ack"]');
  const count = await unacked.count();
  if (!count) { say('no unacked rows left'); break; }
  const idx = Math.floor(Math.random() * Math.min(count, 3)); // a person picks from the top rows
  const res = await humanAck(idx);
  if (res.skipped) { say('skip: row ' + res.intended + ' has no ack button'); continue; }
  attempts.push(res);
  say('meant row ' + res.intended + ', clicked at ' + res.clickedAt.toFixed(1) + 's');
  await sleep(1500 + Math.random() * 1000);
}

await shot();
await ctx.close();
await browser.close();

// match receipts to attempts
console.log('\nattempts:', JSON.stringify(attempts));
console.log('events:', JSON.stringify(events));
fs.writeFileSync('race-attempts.json', JSON.stringify({ attempts, events }, null, 2));
console.log('frames:', fs.readdirSync(outDir).length);
