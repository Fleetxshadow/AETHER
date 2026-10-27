import { chromium, expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const expect = baseExpect.configure({ timeout: 30000 });
const base = process.env.NEXUS_QA_URL || 'http://127.0.0.1:3001';
const root = 'docs/aether';
await fs.mkdir(`${root}/screenshots`, { recursive: true });
const themes = ['eclipse', 'original', 'aqua', 'spectrum', 'sage'];
const desktopOnly = process.argv.includes('--desktop-only');
const resultFile = desktopOnly ? 'validation-desktop.json' : 'validation.json';
const results = { matrix: [], accessibility: [], motion: null, failures: [] };
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});
async function audit(page, theme, surface) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  results.accessibility.push({
    theme,
    surface,
    violations: violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  });
  expect(violations, `${theme} ${surface} accessibility`).toEqual([]);
}
async function noLegacy(page) {
  expect(await page.locator('body').innerText()).not.toMatch(/\bNEXUS\b/i);
  expect(
    await page
      .locator('[aria-label],[title],[alt]')
      .evaluateAll((els) =>
        els
          .flatMap((e) => ['aria-label', 'title', 'alt'].map((k) => e.getAttribute(k) || ''))
          .join('\n'),
      ),
  ).not.toMatch(/\bNEXUS\b/i);
}
try {
  for (const [width, height] of desktopOnly
    ? [[1440, 900]]
    : [
        [390, 844],
        [768, 1024],
        [1280, 720],
        [1440, 900],
      ]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      for (const theme of themes) {
        const name = `${theme}-${width}x${height}-${reducedMotion}`;
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
        await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
        const page = await context.newPage();
        const errors = [],
          network = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        page.on('requestfailed', (r) => {
          if (!r.failure()?.errorText.includes('ERR_ABORTED'))
            network.push(`${new URL(r.url()).pathname}: ${r.failure()?.errorText}`);
        });
        page.on('response', (r) => {
          if (r.status() >= 400) network.push(`${r.status()} ${new URL(r.url()).pathname}`);
        });
        try {
          await page.goto(base);
          await expect(
            page.getByRole('heading', { name: 'AETHER CITY', exact: true }),
          ).toBeVisible();
          await page.locator('.city-portal canvas').waitFor();
          await expect(page.locator('.hero [data-point=central]')).toBeVisible();
          await expect(page.locator('.experience')).toHaveAttribute(
            'data-entrance',
            reducedMotion === 'reduce' ? 'static' : 'complete',
          );
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await noLegacy(page);
          const layout = await page.evaluate(() => {
            const rect = (s) => {
              const r = document.querySelector(s).getBoundingClientRect();
              return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            };
            const copy = rect('.cinema-copy'),
              dock = rect('.observatory-dock'),
              footer = rect('.cinema-footer'),
              scene = rect('.city-portal');
            const canvas = document.querySelector('.city-portal canvas');
            return {
              copy,
              dock,
              footer,
              scene,
              navBrand: rect('.cinema-nav .brand'),
              navActions: rect('.nav-actions'),
              wordmarkWidth: document
                .querySelector('.cinema-nav .brand-wordmark')
                .getBoundingClientRect().width,
              overflow: document.documentElement.scrollWidth > innerWidth,
              alpha: canvas.getContext('webgl2').getContextAttributes().alpha,
              clip: getComputedStyle(document.querySelector('.portal-scene-clip')).clipPath,
              targets: [...document.querySelectorAll('.hero-layer-shortcuts button')].map((e) => ({
                width: e.getBoundingClientRect().width,
                height: e.getBoundingClientRect().height,
              })),
            };
          });
          expect(layout.overflow).toBe(false);
          expect(layout.wordmarkWidth).toBeGreaterThanOrEqual(100);
          expect(layout.navBrand.right + 8).toBeLessThanOrEqual(layout.navActions.left);
          expect(layout.alpha).toBe(true);
          expect(layout.clip).not.toBe('none');
          expect(layout.copy.bottom + 8).toBeLessThan(layout.footer.top);
          if (width <= 960) expect(layout.copy.bottom + 12).toBeLessThan(layout.dock.top);
          expect(layout.targets.every((r) => r.width >= 44 && r.height >= 44)).toBe(true);
          await page
            .locator('.cinematic-hero')
            .screenshot({ path: `${root}/screenshots/hero-${name}.png` });
          if (width === 1440 && reducedMotion === 'no-preference') await audit(page, theme, 'home');
          if (theme === 'eclipse' && width === 390) {
            await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Explore AETHER' })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(
              page.getByRole('button', { name: 'Open navigation', exact: true }),
            ).toBeFocused();
          }
          await page.goto(`${base}/command`);
          await expect(
            page.getByRole('heading', { name: 'AETHER COMMAND', exact: true }),
          ).toBeVisible();
          await page.locator('.map-record-marker').first().waitFor();
          await noLegacy(page);
          await expect(page.locator('.telemetry-instrument')).toHaveCount(4);
          for (const panel of await page.locator('.telemetry-instrument').all()) {
            await expect(panel.locator('.kpi-source')).toHaveText('SIMULATED DEMO');
            await expect(panel.locator('.kpi-context')).toContainText('Current 15:00 IST');
          }
          const toolbar = page.getByRole('group', { name: 'City map toolbar' });
          for (const label of [
            'Intelligence network',
            'Mobility',
            'Surface heat',
            'Water systems',
          ]) {
            const button = toolbar.getByRole('button', { name: label, exact: true });
            const bounds = await button.boundingBox();
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(bounds.width).toBeGreaterThanOrEqual(44);
            await button.focus();
            await page.keyboard.press('Enter');
            await expect(button).toHaveAttribute('aria-pressed', 'true');
          }
          const marker = page.locator('.map-record-marker').first();
          await marker.focus();
          await page.keyboard.press('Enter');
          await expect(
            page.getByRole('button', { name: 'Close observation details' }),
          ).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(marker).toBeFocused();
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
            false,
          );
          if (reducedMotion === 'no-preference')
            await page.screenshot({
              path: `${root}/screenshots/command-${theme}-${width}.png`,
              fullPage: true,
            });
          if (width === 1440 && reducedMotion === 'no-preference')
            await audit(page, theme, 'command');
          expect(errors).toEqual([]);
          expect(network).toEqual([]);
          results.matrix.push({ name, layout, errors, network });
          console.log(`${name}: passed`);
        } catch (error) {
          results.failures.push({ name, error: String(error), errors, network });
          console.log(`${name}: FAILED ${String(error).slice(0, 500)}`);
        } finally {
          await context.close();
          await fs.writeFile(`${root}/${resultFile}`, JSON.stringify(results, null, 2));
        }
      }
    }
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${root}/recordings`, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(base);
  await expect(page.locator('.experience')).toHaveAttribute('data-entrance', 'complete', {
    timeout: 30000,
  });
  await page.evaluate(() => {
    window.__aetherMotionProof = [];
    const until = performance.now() + 10000;
    const sample = () => {
      const element = document.querySelector('.cinema-title-line > span');
      if (element) {
        const style = getComputedStyle(element);
        window.__aetherMotionProof.push([style.transform, style.translate, style.opacity]);
      }
      if (performance.now() < until) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole('button', { name: 'Replay introduction' }).click();
  await expect(page.locator('.experience')).toHaveAttribute('data-entrance', 'complete', {
    timeout: 30000,
  });
  const headingFrames = await page.evaluate(
    () => new Set(window.__aetherMotionProof.map((frame) => JSON.stringify(frame))).size,
  );
  expect(headingFrames).toBeGreaterThan(1);
  const travelling = page.locator('.route-transition[data-transition=travelling]').waitFor();
  await page.getByRole('link', { name: 'Enter AETHER command', exact: true }).click();
  await travelling;
  await expect(page.getByRole('heading', { name: 'AETHER COMMAND', exact: true })).toBeVisible();
  await page.goto(`${base}/command/response`);
  await page.getByRole('button', { name: 'Simulate incoming call' }).click();
  await page.getByRole('button', { name: 'Accept demo' }).click();
  await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
  await expect(page.locator('.demo-conversation')).toContainText('AETHER AI');
  await expect(page.locator('.demo-conversation')).toContainText(
    "I've added this as a simulated waterlogging report",
  );
  await audit(page, 'eclipse', 'response-demo');
  await noLegacy(page);
  const video = page.video();
  await context.close();
  await video.saveAs(`${root}/aether-motion.webm`);
  results.motion = {
    heroTransformChanged: true,
    routeTransition: true,
    demoCall: true,
    video: 'aether-motion.webm',
  };
} finally {
  await browser.close();
  await fs.writeFile(`${root}/${resultFile}`, JSON.stringify(results, null, 2));
}
expect(results.failures).toEqual([]);
console.log(
  `${results.matrix.length} matrix scenarios; ${results.accessibility.length} accessibility scans; motion and call verified.`,
);
