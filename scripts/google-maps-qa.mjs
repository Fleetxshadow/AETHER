import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const mock = process.argv.includes('--mock');
const base = process.env.NEXUS_QA_URL || `http://127.0.0.1:${mock ? 3002 : 3001}`;
const root = 'docs/google-maps';
await fs.mkdir(`${root}/screenshots`, { recursive: true });
const fixture = await fs.readFile('tests/fixtures/google-maps-api.js', 'utf8');
const report = {
  mode: mock ? 'API TEST DOUBLE — no real Google map verified' : 'Production without API key',
  matrix: [],
  checks: [],
  consoleErrors: [],
  failures: [],
};
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});
const sizes = [
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1440, 900],
];
try {
  for (const [width, height] of sizes)
    for (const reducedMotion of ['no-preference', 'reduce'])
      for (const theme of mock
        ? ['eclipse']
        : ['eclipse', 'original', 'aqua', 'spectrum', 'sage']) {
        const context = await browser.newContext({
          viewport: { width, height },
          reducedMotion,
          geolocation: { latitude: 28.4595, longitude: 77.0266 },
          permissions: ['geolocation'],
        });
        await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
        const page = await context.newPage();
        const errors = [],
          failed = [],
          requests = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        page.on('requestfailed', (r) => {
          if (r.failure()?.errorText !== 'net::ERR_ABORTED') failed.push(new URL(r.url()).pathname);
        });
        let loads = 0;
        await page.route('https://maps.googleapis.com/maps/api/js?**', async (route) => {
          loads++;
          if (!mock) throw new Error('Unconfigured production must not request Maps');
          await route.fulfill({ contentType: 'application/javascript', body: fixture });
        });
        page.on('request', (r) =>
          requests.push({ method: r.method(), path: new URL(r.url()).pathname }),
        );
        await page.goto(`${base}/command`);
        const map = page.locator('.aether-operational-map');
        await expect(map).toHaveAttribute('data-map-state', mock ? 'ready' : 'missing', {
          timeout: 60000,
        });
        await expect(page.locator('.observation-row')).toHaveCount(8);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const tooSmall = await page
          .locator('.aether-map-toolbar button,.aether-map-toolbar select,.aether-map-demo')
          .evaluateAll((elements) =>
            elements
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return r.width < 44 || r.height < 44;
              })
              .map((e) => e.textContent),
          );
        expect(tooSmall).toEqual([]);
        const tools = await page.locator('.aether-map-toolbar').boundingBox(),
          surface = await page.locator('.aether-map-surface').boundingBox();
        expect(tools.y + tools.height).toBeLessThanOrEqual(surface.y + 1);
        await page.getByLabel('AETHER map overlay', { exact: true }).focus();
        await page.keyboard.press('Tab');
        const demo = page.getByRole('checkbox', { name: 'Show simulated pins' });
        await expect(demo).toBeFocused();
        expect(await demo.evaluate((e) => e.matches(':focus-visible'))).toBe(true);
        await page.keyboard.press('Space');
        await expect(demo).toBeChecked();
        if (mock) {
          expect(loads).toBe(1);
          const options = await page.evaluate(() => {
            const m = window.__mapsEvidence.maps.at(-1);
            return {
              center: m.center,
              keyboard: m.options.keyboardShortcuts,
              gestures: m.options.gestureHandling,
            };
          });
          expect(options).toEqual({
            center: { lat: 28.4595, lng: 77.0266 },
            keyboard: true,
            gestures: 'cooperative',
          });
          await page.getByRole('button', { name: 'Fit visible records', exact: true }).click();
          const marker = page.locator('.aether-map-pin').filter({
            has: page.locator('.aether-map-pin-label', { hasText: 'Smoke signature detected' }),
          });
          await expect(marker).toBeVisible();
          expect(await marker.evaluate((e) => e.tagName)).toBe('BUTTON');
          await marker.focus();
          await marker.evaluate((e) => {
            e.dataset.identityProbe = 'retained';
          });
          await page.evaluate(() =>
            window.dispatchEvent(
              new CustomEvent('nexus:fixture', {
                detail: { feed: 'observations', connection: 'connected', rows: [] },
              }),
            ),
          );
          await expect(marker).toHaveAttribute('data-identity-probe', 'retained');
          await page.keyboard.press('Enter');
          await expect(
            page.getByRole('button', { name: 'Close observation details' }),
          ).toBeFocused();
          await expect(page.locator('.aether-map-selection')).toContainText('DEMO');
          const methods = await page.evaluate(() =>
            window.__mapsEvidence.cameras.map((c) => c.method),
          );
          expect(methods.includes('panTo')).toBe(reducedMotion === 'no-preference');
          await page.keyboard.press('Escape');
          await expect(marker).toBeFocused();
          await page.getByRole('button', { name: 'Satellite', exact: true }).click();
          expect(await page.evaluate(() => window.__mapsEvidence.maps.at(-1).type)).toBe(
            'satellite',
          );
          await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
          await page.getByRole('button', { name: 'Google traffic', exact: true }).click();
          await expect(
            page.getByRole('button', { name: 'Google traffic', exact: true }),
          ).toHaveAttribute('aria-pressed', 'true');
          expect(await page.evaluate(() => window.__mapsEvidence.traffic.at(-1))).toBe(true);
          await page.getByRole('button', { name: 'Google traffic', exact: true }).click();
          expect(await page.evaluate(() => window.__mapsEvidence.traffic.at(-1))).toBe(false);
          await page.getByRole('button', { name: 'My location', exact: true }).click();
          await expect(map).toContainText('Not saved to AETHER');
          expect(requests.filter((r) => r.method === 'POST')).toEqual([]);
          await page.getByRole('button', { name: 'Reset map camera to Gurugram' }).click();
          await page.getByRole('button', { name: /^Twin(?: mode)?$/ }).click();
          await expect(page.locator('.command-twin .aether-operational-map')).toHaveAttribute(
            'data-map-state',
            'ready',
          );
          expect(loads).toBe(1);
          expect(await page.evaluate(() => window.__mapsEvidence.maps.at(-1).type)).toBe(
            'satellite',
          );
        } else {
          expect(loads).toBe(0);
          await expect(page.getByRole('button', { name: 'Satellite', exact: true })).toBeDisabled();
          await expect(page.locator('.aether-map-pin')).toHaveCount(0);
          await page.getByLabel('AETHER map overlay', { exact: true }).selectOption('core');
          await expect(map).toContainText('CORE places only findings');
          await page.getByLabel('AETHER map overlay', { exact: true }).selectOption('command');
        }
        if (reducedMotion === 'reduce') {
          const audit = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(
            audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ).toEqual([]);
        }
        await page.locator('.aether-operational-map').screenshot({
          path: `${root}/screenshots/${mock ? 'test-double' : 'missing-key'}-${width}x${height}-${theme}-${reducedMotion}.png`,
        });
        expect(errors).toEqual([]);
        expect(failed).toEqual([]);
        report.matrix.push({
          width,
          height,
          reducedMotion,
          theme,
          state: mock ? 'mock-ready' : 'missing',
          errors,
          failed,
        });
        console.log(
          `PASS ${mock ? 'test-double' : 'missing-key'} ${width}x${height} ${theme} ${reducedMotion}`,
        );
        await context.close();
      }
  if (mock) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: fixture }),
    );
    await page.goto(`${base}/command/response`);
    await expect(page.locator('.aether-operational-map')).toHaveAttribute(
      'data-map-state',
      'ready',
    );
    await page.getByRole('checkbox', { name: 'Show simulated reports', exact: true }).check();
    await page.getByLabel('Incident map overlay', { exact: true }).selectOption('aqua');
    await page.getByRole('button', { name: 'Fit visible records', exact: true }).click();
    const pin = page.locator('.aether-map-pin').first();
    await expect(pin).toBeVisible();
    await pin.click();
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.aether-map-selection')).toBeVisible();
    await page.getByLabel('Incident map overlay', { exact: true }).selectOption('incident');
    await expect(page.locator('.aether-map-pin')).toHaveCount(0);
    await page.getByRole('button', { name: 'Simulate incoming call', exact: true }).click();
    await page.getByRole('button', { name: 'Accept demo', exact: true }).click();
    await expect(page.locator('.response-queue-item')).toHaveCount(1);
    await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
    await expect(page.locator('.aether-map-pin')).toHaveCount(0);
    await page.getByRole('button', { name: 'End demo call', exact: true }).click();
    expect(errors).toEqual([]);
    report.checks.push({
      feature: 'RESPONSE observation selection; coordinate-free reports stay unplaced',
      passed: true,
    });
    await context.close();
    console.log('PASS RESPONSE selection and unplaced simulated report');
    for (const failure of ['authorization', 'network', 'timeout']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
        failure === 'network'
          ? route.abort('failed')
          : route.fulfill({
              contentType: 'application/javascript',
              body: failure === 'timeout' ? '/* intentionally never completes */' : fixture,
            }),
      );
      await page.goto(`${base}/command`);
      if (failure === 'authorization') {
        await expect(page.locator('.aether-operational-map')).toHaveAttribute(
          'data-map-state',
          'ready',
        );
        await page.evaluate(() => window.gm_authFailure());
      }
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        failure === 'authorization' ? 'authorization' : 'network',
        { timeout: 30000 },
      );
      await expect(page.getByRole('button', { name: 'Reload map', exact: true })).toBeVisible();
      await expect(page.locator('.observation-row')).toHaveCount(8);
      expect(pageErrors).toEqual([]);
      report.checks.push({ failure, handled: true });
      await context.close();
      console.log(`PASS intentional ${failure}`);
    }
  }
} catch (error) {
  report.failures.push(error.stack || String(error));
  process.exitCode = 1;
  console.error(error);
} finally {
  await fs.writeFile(
    `${root}/${mock ? 'api-double' : 'production'}-validation.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
