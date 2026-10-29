import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const mock = process.argv.includes('--mock');
const themesOnly = process.argv.includes('--themes-only');
const base = process.env.NEXUS_QA_URL || 'http://127.0.0.1:3002';
const root = 'docs/geo-intelligence';
await fs.mkdir(root + '/screenshots', { recursive: true });
const api = await fs.readFile('tests/fixtures/google-maps-api.js', 'utf8');
const example = JSON.parse(await fs.readFile('public/demo/aether-spatial-review.geojson', 'utf8'));
const clean = (value) =>
  String(value)
    .replace(/AIza[\w-]+/g, '[redacted]')
    .replace(/([?&](?:key|token)=)[^&\s]+/gi, '$1[redacted]');
const report = {
  mode: mock ? 'API TEST DOUBLE, not geographic proof' : 'Actual Google Maps API',
  matrix: [],
  checks: [],
  failures: [],
};
const browser = await chromium.launch({ channel: 'chrome' });
const sizes = [
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1440, 900],
];
const routeApi = (page) =>
  page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: api }),
  );
async function showLayers(page) {
  const details = page.locator('.geo-controls>details').first();
  if (!(await details.evaluate((e) => e.open))) await details.locator('summary').click();
}
async function selectRecord(page, text) {
  await page.locator('.geo-record-row').filter({ hasText: text }).click();
  await expect(page.locator('.geo-record-detail h3')).toContainText(text);
}
try {
  for (const [width, height] of themesOnly ? [] : sizes)
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
      await context.addCookies([{ name: 'nexus-theme', value: 'eclipse', url: base }]);
      const page = await context.newPage(),
        errors = [],
        network = [];
      await page.addInitScript(() => {
        window.__geoLongTasks = [];
        new PerformanceObserver((list) =>
          window.__geoLongTasks.push(...list.getEntries().map((e) => e.duration)),
        ).observe({ type: 'longtask', buffered: true });
      });
      page.on('pageerror', (e) => errors.push(clean(e.message)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(clean(m.text()));
      });
      page.on('requestfailed', (r) => {
        if (r.failure()?.errorText !== 'net::ERR_ABORTED')
          network.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText });
      });
      if (mock) await routeApi(page);
      await page.goto(base + '/command/geo', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        'ready',
        { timeout: 60000 },
      );
      await page.getByRole('button', { name: 'Satellite', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Satellite', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByRole('button', { name: 'Roadmap', exact: true }).click();
      await expect(page.locator('.geo-record-row')).toHaveCount(0);
      await page
        .getByRole('button', { name: 'Explore labeled DEMO scenario', exact: true })
        .click();
      await showLayers(page);
      await selectRecord(page, 'Sector review / simulated aerial trail');
      await expect(page.locator('.geo-provenance')).toHaveText('SIMULATED / DEMO');
      await expect(page.locator('.geo-record-detail')).toContainText('simulated');
      const mapBefore = mock ? await page.evaluate(() => window.__mapsEvidence.maps.length) : null;
      await page
        .getByRole('combobox', { name: 'Observation review session', exact: true })
        .selectOption('DEMO-SKY-01');
      const slider = page.getByRole('slider', { name: 'Observation event time', exact: true });
      await slider.focus();
      await page.keyboard.press('Home');
      await expect(slider).toHaveValue('0');
      await page.getByRole('button', { name: 'Next observation event', exact: true }).click();
      await expect(slider).toHaveValue('1');
      if (mock) {
        const sampleCount = await page.evaluate(
          () =>
            window.__mapsEvidence.dataLayers.at(-1).getFeatureById('DEMO-SKY-01').geometry
              .coordinates.length,
        );
        expect(sampleCount).toBe(2);
      }
      await page.getByRole('button', { name: 'Play observation timeline', exact: true }).click();
      await expect
        .poll(() => slider.inputValue().then(Number), { timeout: 6000 })
        .toBeGreaterThan(1);
      await page.getByRole('button', { name: 'Pause observation timeline', exact: true }).click();
      await page
        .getByRole('combobox', { name: 'Observation review session', exact: true })
        .selectOption('all');
      await selectRecord(page, 'Potential pooling / demo estimate');
      await expect(page.locator('.geo-estimate')).toContainText('not a confirmed hazard perimeter');
      await page.getByRole('checkbox', { name: 'AETHER AQUA layer', exact: true }).uncheck();
      await expect(
        page.locator('.geo-record-row').filter({ hasText: 'Potential pooling / demo estimate' }),
      ).toHaveCount(0);
      await page.getByRole('checkbox', { name: 'AETHER AQUA layer', exact: true }).check();
      await selectRecord(page, 'Two review zones / DEMO MultiPolygon');
      await page.getByRole('button', { name: 'Reset map camera to Gurugram', exact: true }).click();
      const cluster = page.locator('.aether-map-cluster').first();
      await expect(cluster).toBeVisible();
      await cluster.click();
      await expect(page.locator('.geo-record-browser h3')).toHaveText('Cluster selection');
      await expect(page.locator('.geo-record-browser h3')).toBeFocused();
      await page.getByRole('button', { name: 'Show all matching records', exact: true }).click();
      await selectRecord(page, 'Potential pooling / demo estimate');
      if (mock) {
        expect(await page.evaluate(() => window.__mapsEvidence.maps.length)).toBe(mapBefore);
        const addsBefore = await page.evaluate(
          () =>
            window.__mapsEvidence.featureUpdates.filter(
              (v) => v.action === 'add' && v.id === 'DEMO-GEO-01',
            ).length,
        );
        await page.getByRole('checkbox', { name: 'AETHER ROAD layer', exact: true }).uncheck();
        expect(
          await page.evaluate(
            () =>
              window.__mapsEvidence.featureUpdates.filter(
                (v) => v.action === 'add' && v.id === 'DEMO-GEO-01',
              ).length,
          ),
        ).toBe(addsBefore);
        await page.getByRole('checkbox', { name: 'AETHER ROAD layer', exact: true }).check();
        const path = page.locator('svg path[data-feature-id="DEMO-AQUA-AREA"]');
        await path.click({ position: { x: 30, y: 35 } });
        await expect(page.locator('.geo-record-detail')).toHaveAttribute(
          'data-feature-id',
          'DEMO-AQUA-AREA',
        );
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const small = await page
        .locator(
          '.geo-controls label,.geo-controls summary,.geo-playback button,.geo-timeline summary,.geo-record-row,.aether-map-toolbar button,.aether-map-cluster',
        )
        .evaluateAll((elements) =>
          elements
            .filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width && r.height && (r.height < 44 || r.width < 44);
            })
            .map((e) => e.textContent),
        );
      expect(small).toEqual([]);
      if (reducedMotion === 'reduce') {
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
      }
      await page.getByRole('heading', { name: 'AETHER GEO', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${root}/screenshots/${mock ? 'mock' : 'real'}-${width}x${height}-${reducedMotion}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
      expect(network).toEqual([]);
      report.matrix.push({
        width,
        height,
        reducedMotion,
        consoleErrors: errors,
        networkFailures: network,
        passed: true,
        performance: await page.evaluate(() => ({
          domReadyMs: Math.round(
            performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0,
          ),
          longTaskCount: window.__geoLongTasks.length,
          maxLongTaskMs: Math.round(Math.max(0, ...window.__geoLongTasks)),
        })),
      });
      console.log(`PASS ${mock ? 'mock' : 'real'} ${width}x${height} ${reducedMotion}`);
      await context.close();
    }
  if (mock) {
    for (const theme of themesOnly
      ? ['eclipse', 'original', 'aqua', 'spectrum', 'sage']
      : ['original', 'aqua', 'spectrum', 'sage']) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
      });
      await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
      const page = await context.newPage();
      await routeApi(page);
      await page.goto(base + '/command/geo');
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        'ready',
      );
      await page
        .getByRole('button', { name: 'Explore labeled DEMO scenario', exact: true })
        .click();
      await selectRecord(page, 'Potential pooling / demo estimate');
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByRole('heading', { name: 'AETHER GEO', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${root}/screenshots/theme-${theme}.png`, fullPage: true });
      report.checks.push({ theme, accessibility: 'passed' });
      console.log('PASS theme ' + theme);
      await context.close();
    }
  }
  if (mock && !themesOnly) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
      page = await context.newPage();
    await routeApi(page);
    let posts = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST') posts++;
    });
    await page.goto(base + '/command/geo');
    await expect(page.locator('.aether-operational-map')).toHaveAttribute(
      'data-map-state',
      'ready',
    );
    await page.locator('.geo-import summary').click();
    const file = page.locator('.geo-file-button input');
    const upload = async (value) =>
      file.setInputFiles({
        name: 'review.geojson',
        mimeType: 'application/geo+json',
        buffer: Buffer.from(JSON.stringify(value)),
      });
    await upload({
      type: 'FeatureCollection',
      features: [
        {
          ...example.features[0],
          properties: {
            ...example.features[0].properties,
            source: 'AUTHORIZED',
            pathStatus: 'RECORDED',
            audience: 'OPERATOR',
          },
        },
      ],
    });
    await expect(page.locator('.geo-import-status')).toContainText('provenance');
    const local = structuredClone(example.features[0]);
    local.id = 'LOCAL-TRAIL';
    Object.assign(local.properties, {
      title: 'Imported recorded observation',
      source: 'LOCAL',
      pathStatus: 'RECORDED',
      audience: 'OPERATOR',
    });
    await upload({ type: 'FeatureCollection', features: [local] });
    await expect(page.locator('.geo-import-status')).toContainText('operator');
    await upload(example);
    await expect(page.locator('.geo-import-status')).toContainText('13 features imported');
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('nexus:fixture', {
          detail: { feed: 'devices', connection: 'connected', rows: [] },
        }),
      ),
    );
    await expect(page.locator('.geo-import-status')).toContainText('access changed');
    await upload({ type: 'FeatureCollection', features: [local] });
    await expect(page.locator('.geo-import-status')).toContainText('1 features imported');
    await selectRecord(page, 'Imported recorded observation');
    await expect(page.locator('.geo-provenance')).toHaveText('LOCAL FILE / UNVERIFIED');
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent('nexus:fixture', { detail: { reset: true } })),
    );
    await expect(page.locator('.geo-provenance')).toHaveCount(0);
    await expect(page.locator('.geo-import-status')).toContainText('access changed');
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('nexus:fixture', { detail: { feed: 'observations', connection: 'error' } }),
      ),
    );
    await expect(page.locator('.data-source-panel')).toContainText('DEVICE OFFLINE');
    await expect(page.locator('.aether-operational-map')).toHaveAttribute(
      'data-map-state',
      'ready',
    );
    expect(posts).toBe(0);
    report.checks.push({
      name: 'GeoJSON import trust, operator access, access loss cleanup, Firebase feed error, no writes',
      passed: true,
    });
    console.log('PASS import/access/error/no-write checks');
    await context.close();
    for (const failure of ['authorization', 'network']) {
      const context = await browser.newContext(),
        page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(clean(e.message)));
      await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
        failure === 'network'
          ? route.abort('failed')
          : route.fulfill({ contentType: 'application/javascript', body: api }),
      );
      await page.goto(base + '/command/geo');
      if (failure === 'authorization') {
        await expect(page.locator('.aether-operational-map')).toHaveAttribute(
          'data-map-state',
          'ready',
        );
        await page.evaluate(() => window.gm_authFailure());
      }
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        failure === 'network' ? 'network' : 'authorization',
      );
      await page
        .getByRole('button', { name: 'Explore labeled DEMO scenario', exact: true })
        .click();
      await selectRecord(page, 'Potential pooling / demo estimate');
      await expect(page.getByRole('button', { name: 'Satellite', exact: true })).toBeDisabled();
      expect(errors).toEqual([]);
      report.checks.push({ failure, independentReview: 'passed' });
      console.log('PASS optional map ' + failure + ' failure');
      await context.close();
    }
  }
} catch (error) {
  report.failures.push(clean(error.stack || error));
  process.exitCode = 1;
  console.error(clean(error.message || error));
} finally {
  await fs.writeFile(
    `${root}/${themesOnly ? 'themes' : mock ? 'mock' : 'real'}-validation.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
