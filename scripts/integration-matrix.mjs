import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const base = process.env.NEXUS_QA_URL || 'http://localhost:3002';
const root = 'docs/integration/verified';
fs.mkdirSync(root, { recursive: true });
// Resume only against the same unchanged production build.
const results =
  process.env.NEXUS_QA_RESUME === 'true' && fs.existsSync(`${root}/results.json`)
    ? JSON.parse(fs.readFileSync(`${root}/results.json`, 'utf8'))
    : { matrix: [], modules: [] };
let current;
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});
try {
  for (const theme of ['original', 'aqua', 'spectrum', 'sage'])
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
    ])
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const name = `${theme}-${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
        if (results.matrix.some((result) => result.name === name)) continue;
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
        await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
        await context.addInitScript(() => {
          localStorage.setItem(
            'nexus-preferences-v2',
            JSON.stringify({ state: { quality: 'low', motion: true }, version: 0 }),
          );
          window.__entranceStates = [];
          new MutationObserver(() => {
            const value = document.querySelector('.rebirth')?.getAttribute('data-entrance');
            if (value && !window.__entranceStates.includes(value))
              window.__entranceStates.push(value);
          }).observe(document, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-entrance'],
          });
        });
        const page = await context.newPage(),
          errors = [],
          network = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        page.on('requestfailed', (r) => {
          if (!r.failure()?.errorText.includes('ERR_ABORTED'))
            network.push(`${r.method()} ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`);
        });
        page.on('response', (r) => {
          if (r.status() >= 400) network.push(`${r.status()} ${new URL(r.url()).pathname}`);
        });
        current = { name, page, errors, network };
        await page.goto(base);
        // Streaming HTML can briefly contain a hidden replacement tree. Require one
        // settled, hydrated page instead of failing immediately on that transient tree.
        await page.waitForFunction(
          (phase) => {
            const roots = document.querySelectorAll('.rebirth');
            return roots.length === 1 && roots[0].getAttribute('data-entrance') === phase;
          },
          reducedMotion === 'reduce' ? 'static' : 'complete',
          { timeout: 45000 },
        );
        await page.locator('.cinematic-hero canvas').waitFor({ timeout: 45000 });
        const city = await page.locator('.cinematic-hero canvas').evaluate((c) => ({
          alpha: c.getContext('webgl2').getContextAttributes().alpha,
          clip: getComputedStyle(c.closest('.portal-scene-clip')).clipPath,
        }));
        expect(city.alpha).toBe(true);
        expect(city.clip).not.toBe('none');
        const entrance = await page.evaluate(() => window.__entranceStates);
        if (reducedMotion === 'no-preference') expect(entrance).toContain('playing');
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        await page.locator('.cinematic-hero').screenshot({ path: `${root}/hero-${name}.png` });
        await page.goto(`${base}/command`);
        await expect(page.locator('.observation-row')).toHaveCount(8);
        await expect(page.locator('.map-record-marker').first()).toBeVisible({ timeout: 45000 });
        await expect(page.locator('.data-source-panel')).toContainText('no Firebase configuration');
        await expect(page.locator('.kpi-source')).toHaveText([
          'SIMULATED DEMO',
          'SIMULATED DEMO',
          'SIMULATED DEMO',
          'SIMULATED DEMO',
        ]);
        const toolbar = page.getByRole('group', { name: 'City map toolbar' });
        for (const label of ['Intelligence network', 'Mobility', 'Surface heat', 'Water systems']) {
          const control = toolbar.getByRole('button', { name: label, exact: true });
          const box = await control.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          await control.focus();
          await page.keyboard.press('Enter');
          await expect(control).toHaveAttribute('aria-pressed', 'true');
        }
        const marker = page.locator('.map-record-marker').first();
        await marker.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('button', { name: 'Close observation details' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(marker).toBeFocused();
        await page.locator('.command-main').screenshot({ path: `${root}/command-${name}.png` });
        await page.goto(`${base}/command/sky`);
        await expect(page.locator('.camera-panel')).toBeVisible();
        await expect(page.locator('.camera-status')).toContainText('DEMO');
        await expect(page.locator('.camera-fallback')).toBeVisible();
        await page.getByRole('button', { name: 'Refresh camera registry' }).focus();
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        const scan = await new AxeBuilder({ page })
          .include('.camera-panel')
          .include('.data-source-panel')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        await page.locator('.camera-panel').screenshot({ path: `${root}/camera-${name}.png` });
        let responseDemo = false;
        if (theme === 'original' && [390, 1440].includes(width)) {
          await page.goto(`${base}/command/response`);
          await page.getByRole('button', { name: 'Simulate incoming call' }).click();
          await page.getByRole('button', { name: 'Accept demo' }).click();
          await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
          await expect(page.locator('.simulated-channel-disclosure')).toContainText(
            'No phone/audio connection',
          );
          await expect(page.locator('.response-detail')).toContainText('Sector 51, Gurugram');
          await page.getByRole('button', { name: 'Play sample conversation' }).click();
          await expect(
            page.getByRole('button', { name: 'Pause sample conversation' }),
          ).toBeVisible();
          await page.getByRole('button', { name: 'Pause sample conversation' }).click();
          await page.getByRole('button', { name: 'Restart sample conversation' }).click();
          await page.getByRole('button', { name: 'End demo call' }).click();
          await expect(page.locator('.response-state')).toHaveText('ended');
          await expect(
            page.getByRole('button', { name: 'Restart sample conversation' }),
          ).toBeDisabled();
          responseDemo = true;
        }
        const result = {
          name,
          city,
          entrance,
          errors,
          network,
          responseDemo,
          violations: scan.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        };
        expect(errors, name).toEqual([]);
        expect(network, name).toEqual([]);
        expect(scan.violations, name).toEqual([]);
        results.matrix.push(result);
        fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
        await context.close();
        process.stdout.write(`PASS ${name}\n`);
      }
  results.modules = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    page = await context.newPage();
  const moduleErrors = [],
    moduleNetwork = [];
  page.on('pageerror', (error) => moduleErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') moduleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      moduleNetwork.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  for (const workspace of [
    'sky',
    'flow',
    'rescue',
    'thermal',
    'aqua',
    'road',
    'fire',
    'twin',
    'core',
    'command',
    'response',
    'reports',
    'settings',
  ]) {
    current = { name: `module-${workspace}`, page, errors: moduleErrors, network: moduleNetwork };
    await page.goto(`${base}/command${workspace === 'command' ? '' : `/${workspace}`}`);
    await page.waitForFunction(() => {
      const headings = document.querySelectorAll('h1');
      const sources = document.querySelectorAll('.data-source-panel');
      return (
        headings.length === 1 &&
        sources.length === 1 &&
        sources[0].getAttribute('data-demo-status') === 'ready'
      );
    });
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.data-source-panel')).toBeVisible();
    expect(moduleErrors, workspace).toEqual([]);
    expect(moduleNetwork, workspace).toEqual([]);
    results.modules.push(workspace);
  }
  await context.close();
  fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
} catch (error) {
  if (current) {
    const { page, ...diagnostic } = current;
    await page.screenshot({ path: `${root}/failure.png`, fullPage: true }).catch(() => {});
    fs.writeFileSync(
      `${root}/failure.json`,
      JSON.stringify({ ...diagnostic, error: String(error) }, null, 2),
    );
    process.stderr.write(JSON.stringify(diagnostic) + '\n');
  }
  throw error;
} finally {
  await browser.close();
}
