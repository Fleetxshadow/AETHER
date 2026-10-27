import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const phase = process.argv[2] || 'after';
const port = process.argv[3] || '3001';
const root = `docs/cinematic/${phase}`;
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1440, 900],
  ]) {
    for (const reducedMotion of phase === 'after'
      ? ['no-preference', 'reduce']
      : ['no-preference']) {
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width < 960,
        isMobile: width < 700,
        reducedMotion,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
      });
      const name =
        phase === 'after'
          ? `${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`
          : String(width);
      await page.goto(`http://localhost:${port}/`);
      await page.locator('.hero canvas').waitFor();
      if (phase === 'after') {
        await expect(page.locator('.rebirth')).toHaveAttribute(
          'data-entrance',
          reducedMotion === 'reduce' ? 'static' : 'complete',
        );
      } else await page.waitForTimeout(2600);
      await page.screenshot({ path: `${root}/hero-${name}.png` });
      await page
        .locator(phase === 'after' ? '.module-explorer-heading' : '#modules')
        .scrollIntoViewIfNeeded();
      await page.waitForTimeout(650);
      if (phase === 'after') {
        await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).click();
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(700);
      }
      await page.locator('#modules').screenshot({
        path: `${root}/modules-${name}.png`,
        style: phase === 'after' ? '.cinema-nav,.skip-link { visibility: hidden !important; }' : '',
      });
      await page.goto(`http://localhost:${port}/command/sky`);
      await page.locator('.drone-scene canvas').waitFor();
      if (phase === 'after')
        await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
      await page.waitForTimeout(1300);
      await page.locator('.engineering-explorer').screenshot({
        path: `${root}/sky-${name}.png`,
        style: phase === 'after' ? '.command-topbar { visibility: hidden !important; }' : '',
      });
      await page.goto(`http://localhost:${port}/command`);
      await page.locator('.map-record-marker').first().waitFor();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${root}/command-${name}.png` });
      expect(errors).toEqual([]);
      console.log(`${phase} ${name}: captured / console clean`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
