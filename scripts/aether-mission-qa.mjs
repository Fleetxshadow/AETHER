import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const expect = baseExpect.configure({ timeout: 30000 });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
async function scan(theme, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.locator('#mission').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.locator('#mission h2').evaluate((e) => getComputedStyle(e.parentElement).opacity),
    )
    .toBe('1');
  const { violations } = await new AxeBuilder({ page })
    .include('#mission')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  results.push({
    theme,
    width,
    violations: violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  });
  await fs.writeFile(
    'docs/aether/mission-accessibility.json',
    JSON.stringify({ results, errors }, null, 2),
  );
  expect(violations).toEqual([]);
  await page.locator('#mission').screenshot({ path: `docs/aether/mission-${theme}-${width}.png` });
  console.log(`${theme}-${width}: mission contrast/accessibility passed`);
}
try {
  await page.goto('http://localhost:3000/');
  for (const [id, name] of [
    ['eclipse', 'AETHER Eclipse'],
    ['original', 'Original'],
    ['aqua', 'Aqua Future'],
    ['spectrum', 'Signal Spectrum'],
    ['sage', 'Bio-Tech Sage'],
  ]) {
    await page.keyboard.press('Control+Home');
    if ((await page.locator('html').getAttribute('data-theme')) !== id) {
      await page.getByRole('button', { name: 'Open theme configurator' }).click();
      await page.locator('.theme-preview').filter({ hasText: name }).click();
      await page.getByRole('button', { name: 'Close theme configurator' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await scan(id, 1440);
    if (id === 'eclipse') await scan(id, 390);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  expect(errors).toEqual([]);
} finally {
  await browser.close();
  await fs.writeFile(
    'docs/aether/mission-accessibility.json',
    JSON.stringify({ results, errors }, null, 2),
  );
}
