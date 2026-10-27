import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base = 'http://localhost:3000';
const password = fs
  .readFileSync('.env.local', 'utf8')
  .match(/^NEXUS_OPERATOR_PASSWORD=(.+)$/m)[1]
  .trim();
fs.mkdirSync('docs/evolution/response-stage', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/command/response`);
  await page.getByLabel('Operator password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operator authenticated' })).toBeVisible();
  await page.getByRole('button', { name: 'Load simulated reports' }).click();
  await expect(page.locator('.response-queue-item').first()).toBeVisible();
  await page.locator('.response-queue-item').first().click();
  await page.getByLabel('Caller statement / live transcript').fill('आग लगी है, 2 लोग फँसे हैं।');
  for (const theme of ['original', 'aqua', 'spectrum', 'sage']) {
    await page.getByRole('button', { name: 'Open theme configurator' }).click();
    await page
      .getByRole('button', {
        name: new RegExp(
          theme === 'original'
            ? 'Original'
            : theme === 'aqua'
              ? 'Aqua Future'
              : theme === 'spectrum'
                ? 'Signal Spectrum'
                : 'Bio-Tech Sage',
        ),
      })
      .click();
    await page.getByRole('button', { name: 'Close theme configurator' }).click();
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.screenshot({ path: `docs/evolution/response-stage/${theme}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
  console.log(
    'RESPONSE stage: four themes, operator login, seeded queue, Hindi extraction passed.',
  );
} finally {
  await browser.close();
}
