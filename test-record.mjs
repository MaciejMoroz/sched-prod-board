import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_URL;
const outDir = process.env.OUT_DIR || 'recordings';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
});
const page = await ctx.newPage();
page.on('console', (m) => console.log('console:', m.type(), m.text()));

await page.goto(base);

// wait for loader then incidents
await page.waitForSelector('[data-testid="loader"]', { timeout: 5000 }).catch(() => console.log('loader never visible'));
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 15000 });
console.log('rows:', await page.locator('[data-testid="incident-row"]').count());
console.log('first row time:', await page.locator('[data-testid="incident-row"] time').first().textContent());
console.log('build-sha:', await page.locator('[data-testid="build-sha"]').textContent());

// wait to show refresh ticking
await page.waitForTimeout(4500);
console.log('rows after refresh:', await page.locator('[data-testid="incident-row"]').count());

// ack first row
const firstRow = page.locator('[data-testid="incident-row"]').first();
const id = await firstRow.getAttribute('data-id');
console.log('acking:', id);
await firstRow.locator('[data-testid="ack"]').click();
await page.waitForSelector('[data-testid="acked"]', { timeout: 15000 });
console.log('acked visible for', id);
await page.waitForTimeout(1500);

const videoPath = await page.video.path();
await ctx.close();
console.log('video:', videoPath);
await browser.close();
