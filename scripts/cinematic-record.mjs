import { chromium, expect } from '@playwright/test';
const port = process.argv[2] || '3001';
const browser = await chromium.launch({
  channel: 'chrome',
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
  recordVideo: { dir: 'docs/cinematic/motion', size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
});
try {
  await page.goto(`http://localhost:${port}/`);
  await page.locator('.hero canvas').waitFor();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'playing');
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.keyboard.press('Escape');
  await page.locator('.intelligence-trigger').click();
  await page.waitForTimeout(1100);
  await page.locator('.intelligence-trigger').click();
  await page.locator('.module-explorer-heading').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await page.locator('.spatial-module-system').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  await page.locator('.nav-command').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(`http://localhost:${port}/command`);
  await expect(page.locator('.route-transition')).toHaveAttribute('data-transition', 'idle');
  await expect(page.locator('.map-record-marker')).toHaveCount(8);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^Analytics/ }).click();
  const chart = page.locator('.chart').first();
  await chart.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1100);
  await chart.getByRole('button', { name: 'View 06:00 IST snapshot', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1100);
  await chart.getByRole('button', { name: 'View 15:00 IST snapshot', exact: true }).click();
  await page.waitForTimeout(900);
  await page
    .getByRole('navigation', { name: 'AETHER modules' })
    .getByRole('link', { name: /^SKY / })
    .click();
  await page.locator('.drone-scene canvas').waitFor();
  await page.locator('.engineering-stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
  await page.waitForTimeout(1700);
  await page
    .locator('.part-list')
    .getByRole('button', { name: /Modular energy pack/ })
    .click();
  await page.waitForTimeout(1400);
  await page
    .locator('.part-list')
    .getByRole('button', { name: /Multisensor gimbal/ })
    .click();
  await page.waitForTimeout(1600);
  expect(errors).toEqual([]);
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs('docs/cinematic/motion/walkthrough.webm');
  await browser.close();
}
console.log('Fixed viewport motion walkthrough captured; console clean.');
