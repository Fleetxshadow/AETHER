import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const output = 'docs/rebirth/after';
fs.mkdirSync(`${output}/recordings`, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
  recordVideo: { dir: `${output}/recordings`, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
await page.locator('.hero canvas').waitFor();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${output}/home-1440.png` });
await page.getByRole('link', { name: 'Enter AETHER command', exact: true }).hover();
await page.mouse.move(210, 712);
await page.waitForTimeout(350);
const magnetic = await page
  .locator('.rebirth-hero-actions .magnetic-wrap')
  .evaluate((el) => getComputedStyle(el).transform);
await page.mouse.wheel(0, 1050);
await page.waitForTimeout(700);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(750);
const chapterA = await page.locator('#city').getAttribute('data-story-step');
await page.locator('.story-sticky').screenshot({ path: `${output}/living-city.png` });
await page.mouse.wheel(0, 650);
await page.waitForTimeout(850);
const chapterB = await page.locator('#city').getAttribute('data-story-step');
assert.notEqual(chapterA, chapterB, 'scroll changes narrative layers');
await page.locator('#network').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const flowA = await page
  .locator('.network-conduit path')
  .first()
  .evaluate((el) => getComputedStyle(el).strokeDashoffset);
await page.waitForTimeout(300);
const flowB = await page
  .locator('.network-conduit path')
  .first()
  .evaluate((el) => getComputedStyle(el).strokeDashoffset);
assert.notEqual(flowA, flowB, 'visible network signal lines animate');
await page.locator('#network').screenshot({ path: `${output}/network.png` });
await page.locator('#modules').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).click();
await page.locator('.orbit-module-copy h3').filter({ hasText: 'AQUA' }).waitFor();
await page.waitForTimeout(600);
await page.locator('#modules').screenshot({ path: `${output}/modules-1440.png` });
await page.locator('#engineering').scrollIntoViewIfNeeded();
await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
await page.getByRole('button', { name: /Modular energy pack/ }).click();
await page.waitForTimeout(1800);
await page.locator('.engineering-explorer').screenshot({ path: `${output}/sky-studio.png` });
await page.getByRole('button', { name: /Flight & sensor computer/ }).click();
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Reset engineering view' }).click();
await page.waitForTimeout(1000);
await page.locator('.action-chapter').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.locator('.action-chapter').screenshot({ path: `${output}/intelligence-action.png` });
await page.locator('.command-closing').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await page.locator('.command-closing').screenshot({ path: `${output}/command-closing.png` });
await page.goto('http://localhost:3001/command', { waitUntil: 'domcontentloaded' });
await page.locator('.map-record-marker').first().waitFor();
await page.screenshot({ path: `${output}/command-1440.png` });
const marker = page.getByRole('button', {
  name: 'Select Smoke signature detected, critical',
  exact: true,
});
await marker.focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${output}/observation-drawer.png` });
await page.keyboard.press('Escape');
await page
  .getByRole('button', { name: 'Close observation details' })
  .waitFor({ state: 'detached' });
assert.equal(
  await marker.evaluate((el) => el === document.activeElement),
  true,
  'map marker restores focus',
);
await page.getByRole('button', { name: 'Analytics mode' }).click();
await page.waitForTimeout(900);
await page.locator('.chart-times button').first().focus();
await page.waitForTimeout(350);
await page.locator('.analytics-grid').screenshot({ path: `${output}/analytics.png` });
assert.deepEqual(errors, []);
fs.writeFileSync(
  `${output}/motion-proof.json`,
  JSON.stringify({ chapterA, chapterB, flowA, flowB, magnetic, errors }, null, 2),
);
const video = page.video();
await context.close();
await video.saveAs(`${output}/recordings/motion-tour.webm`);
await browser.close();
console.log('Motion tour, section screenshots, marker focus and charts verified.');
