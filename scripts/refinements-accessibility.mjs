import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const base = process.env.NEXUS_QA_URL || 'http://localhost:3002';
const root = 'docs/refinements-v2/verified';
const results = { tours: [], accessibility: [] };
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const theme of ['original', 'aqua', 'spectrum', 'sage']) {
    for (const [width, height] of [[390, 844], [768, 1024], [1280, 720], [1440, 900]]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
        await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto(base);
        await page.getByRole('button', { name: /Watch the guided experience/ }).click();
        await page.locator('.presentation canvas').waitFor();
        await page.waitForTimeout(500);
        const name = `${theme}-${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
        await expect(page.getByRole('button', { name: 'Exit presentation' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        expect(await page.locator('.presentation-top').evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
        if (width === 390 || width === 1440) {
          await page.locator('.presentation').screenshot({ path: `${root}/tour-${name}.png` });
        }
        if (width === 1440 && reducedMotion === 'no-preference') {
          const audit = async (workspace) => {
            const { violations } = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
            results.accessibility.push({ theme, workspace, violations });
            expect(violations).toEqual([]);
          };
          await audit('tour');
          await page.keyboard.press('Escape');
          await page.goto(`${base}/command`);
          await page.locator('.map-record-marker').first().waitFor();
          await audit('command');
          await page.screenshot({ path: `${root}/command-${name}.png`, fullPage: true });
          await page.goto(`${base}/command/response`);
          await page.getByRole('button', { name: 'Simulate incoming call' }).click();
          await page.getByRole('button', { name: 'Accept demo' }).click();
          await expect(page.locator('.incoming-call')).toHaveCount(0);
          await expect(page.locator('.demo-conversation')).toContainText("I've added");
          await audit('response-call');
          await page.locator('.response-voice-panel').screenshot({ path: `${root}/call-${name}.png` });
        } else {
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
        }
        expect(errors).toEqual([]);
        results.tours.push({ name, errors });
        await context.close();
        console.log(`${name}: final contrast/tour passed`);
      }
    }
  }
} finally {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(`${root}/accessibility-final.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
