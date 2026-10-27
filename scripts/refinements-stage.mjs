import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const root = 'docs/refinements-v2';
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ name: 'nexus-theme', value: 'aqua', url: 'http://localhost:3000' }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:3000');
  await page.locator('.cinematic-hero canvas').waitFor();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await page.screenshot({ path: `${root}/aqua-after.png` });
  expect(
    await page
      .locator('.cinematic-hero canvas')
      .evaluate((c) => c.getContext('webgl2').getContextAttributes().alpha),
  ).toBe(true);
  await page.goto('http://localhost:3000/command');
  await page.locator('.map-record-marker').first().waitFor();
  await page.screenshot({ path: `${root}/command-after.png` });
  await page.goto('http://localhost:3000/command/response');
  await page.getByRole('button', { name: 'Simulate incoming call' }).click();
  await page.getByRole('button', { name: 'Accept demo' }).click();
  await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
  await expect(page.locator('.demo-conversation')).toContainText(
    "I've added this as a simulated waterlogging report",
  );
  await expect(page.locator('.response-detail')).toContainText('Sector 51, Gurugram');
  await page.screenshot({ path: `${root}/call-after.png`, fullPage: true });
  expect(errors).toEqual([]);
  console.log('Aqua alpha/clip, command toolbar and saved sample-conversation stage passed.');
} finally {
  await browser.close();
}
