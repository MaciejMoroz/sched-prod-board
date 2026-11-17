import { chromium } from 'playwright';

const base = process.env.BASE_URL;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-GB' });
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(base);
await page.waitForSelector('[data-testid="incident-row"]');
const ids = () => page.locator('[data-testid="incident-row"]').evaluateAll((els) => els.map((e) => e.dataset.id));

for (let i = 0; i < 8; i++) {
  const unacked = page.locator('[data-testid="ack"]');
  if (!(await unacked.count())) { await sleep(2000); continue; }
  const btn = unacked.first();
  const intended = await btn.evaluate((b) => b.closest('[data-testid="incident-row"]').dataset.id);
  const box = await btn.boundingBox().catch(() => null);
  if (!box) continue;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const at = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.closest('[data-testid]')?.dataset?.testid || el.tagName) + '#' + (el.closest('[data-testid="incident-row"]')?.dataset?.id || '') : 'none';
  }, [x, y]);
  console.log('before reach: under pointer =', at, 'intended', intended);
  const before0 = (await ids())[0];
  let shifted = false;
  for (let w = 0; w < 40 && !shifted; w++) { await sleep(100); if ((await ids())[0] !== before0) shifted = true; }
  const at2 = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? (el.closest('[data-testid]')?.dataset?.testid || el.tagName) + '#' + (el.closest('[data-testid="incident-row"]')?.dataset?.id || '') : 'none';
  }, [x, y]);
  console.log('at press: under pointer =', at2, shifted ? '(shifted)' : '');
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(700);
  console.log('---');
}
await ctx.close();
await browser.close();
