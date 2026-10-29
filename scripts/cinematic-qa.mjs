import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const mode = process.argv[2] || 'full';
const port = process.argv[3] || '3001';
const root = `docs/cinematic/${mode === 'home' ? 'stage-home' : mode === 'engineering' ? 'stage-engineering' : 'after'}`;
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const selectedWidth = Number(process.argv[4]);
const results = selectedWidth
  ? JSON.parse(fs.readFileSync(`${root}/results.json`, 'utf8')).filter(
      (r) => !r.name.startsWith(`${selectedWidth}x`),
    )
  : [];
async function boxes(page, selector) {
  return page.locator(selector).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return {
        text: e.textContent.trim(),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        font: parseFloat(getComputedStyle(e).fontSize),
      };
    }),
  );
}
function targets(items) {
  // Allow subpixel transform rounding around the CSS 44px minimum.
  items.forEach((r) => assert(r.width >= 43.99 && r.height >= 43.99, JSON.stringify(r)));
}
function grid(items) {
  targets(items);
  assert.equal(items.length, 4);
  assert(Math.abs(items[0].y - items[1].y) < 1);
  assert(Math.abs(items[2].y - items[3].y) < 1);
  assert(items[2].y >= items[0].y + items[0].height);
  assert(items.every((r) => r.font >= 11));
}
async function noOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    'horizontal overflow',
  );
}
async function verifyEngineering(page, name, reducedMotion) {
  await page.goto(`http://localhost:${port}/command/sky`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('.drone-scene canvas').waitFor();
  const parts = [
    ['airframe', '01', 'Carbon composite airframe'],
    ['propulsion', '02', 'Brushless propulsion'],
    ['battery', '03', 'Modular energy pack'],
    ['camera', '04', 'Multisensor gimbal'],
    ['controller', '05', 'Flight & sensor computer'],
  ];
  for (const [id, number, label] of parts) {
    const b = page
      .locator('.part-list')
      .getByRole('button', { name: new RegExp(number + ' ' + label) });
    await b.focus();
    await page.keyboard.press('Enter');
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.studio-status')).toContainText('INSPECTION / ' + number);
    await expect(page.locator('.part-detail-index')).toHaveText(number);
    if (['battery', 'camera', 'controller'].includes(id))
      await expect(page.locator(`.drone-scene [data-point=${id}] button`)).toHaveText(
        number + ' / ' + id.toUpperCase(),
      );
  }
  targets(await boxes(page, '.part-list button,.assembly-switch button,.studio-reset'));
  const motionStart = await page.evaluate(() => window.__cinemaSamples.length);
  await page.getByRole('button', { name: 'Exploded view', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.drone-scene')).toHaveAttribute('data-exploded', 'true');
  await page.waitForTimeout(1600);
  const inspectionProof = await page.evaluate(
    (start) => window.__cinemaSamples.slice(start),
    motionStart,
  );
  const inspectionStates = new Set(inspectionProof.map((v) => v.inspection).filter(Boolean)).size;
  const droneStates = new Set(inspectionProof.map((v) => v.droneProjection).filter(Boolean)).size;
  if (reducedMotion === 'no-preference')
    assert(droneStates > 1, name + ' 3D separation visibly moves callouts');
  const bounds = await page.locator('.drone-scene').boundingBox();
  const callouts = await boxes(page, '.drone-scene .scene-marker');
  targets(callouts);
  for (const id of ['battery', 'controller', 'camera']) {
    const b = page.locator(`.drone-scene [data-point=${id}] button`);
    await expect(b).toBeVisible();
    const r = await b.boundingBox();
    assert(
      r.x >= bounds.x - 2 &&
        r.y >= bounds.y - 2 &&
        r.x + r.width <= bounds.x + bounds.width + 2 &&
        r.y + r.height <= bounds.y + bounds.height + 2,
      name + ' ' + id + ' callout fits',
    );
  }
  await page.locator('.drone-scene [data-point=camera] button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.studio-status')).toContainText('INSPECTION / 04');
  await page.waitForTimeout(1000);
  await page.locator('.engineering-explorer').screenshot({
    path: `${root}/sky-${name}.png`,
    style: '.command-topbar { visibility: hidden !important; }',
  });
  const toggle = page.getByRole('button', { name: 'ASSEMBLY SPECIFICATION', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.part-detail')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.locator('.part-detail-index')).toHaveText('04');
  await page.getByRole('button', { name: 'Reset engineering view', exact: true }).click();
  await expect(page.locator('.drone-scene')).toHaveAttribute('data-exploded', 'false');
  await expect(page.locator('.studio-status')).toContainText('INSPECTION / 04');
  await noOverflow(page);
  return {
    assemblies: '01 airframe / 02 propulsion / 03 battery / 04 camera / 05 controller',
    callouts,
    inspectionStates,
    droneStates,
  };
}

async function verifyCommand(page, name, width, reducedMotion) {
  await page.locator('.map-record-marker').first().waitFor();
  await expect(page.locator('.observation-row')).toHaveCount(8);
  await expect(page.locator('.map-severity-legend')).toContainText(/critical.*elevated.*normal/s);
  targets(await boxes(page, '.map-record-marker,.map-layers button,.focus-bar button'));
  if (width < 700) {
    grid(await boxes(page, '.map-layers button'));
    const [legend] = await boxes(page, '.map-severity-legend');
    const [layers] = await boxes(page, '.map-layers');
    assert(legend.y + legend.height < layers.y, name + ' severity legend clears 2x2 layers');
  }
  const marker = page.getByRole('button', {
    name: 'Select Smoke signature detected, critical',
    exact: true,
  });
  assert.equal(await marker.evaluate((e) => e.tagName), 'BUTTON');
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(marker).toHaveAttribute('aria-pressed', 'true');
  const detail = page.locator('.observation-detail');
  await expect(detail).toContainText('Smoke signature detected');
  for (const t of [
    'Confidence',
    'Observed at',
    'Source',
    'Evidence',
    'Demo aerial dataset',
    'IST',
    'Simulated observation. No real incident verified.',
  ])
    await expect(detail).toContainText(t);
  await expect(detail.locator('.detail-location')).toContainText(/\u00b0 N.*\u00b0 E/);
  await expect(page.getByRole('button', { name: 'Close observation details' })).toBeFocused();
  await detail.getByRole('button', { name: 'Review detection replay' }).click();
  await expect(detail.getByRole('button', { name: 'Play detection replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Close observation details' }).focus();
  await detail.screenshot({ path: `${root}/detail-${name}.png` });
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await expect(marker).toBeFocused();
  await page.getByRole('button', { name: 'Reset map camera', exact: true }).click();
  await page.waitForTimeout(900);
  await page.getByRole('heading', { name: 'AETHER COMMAND', exact: true }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${root}/command-${name}.png` });
  await page.locator('.command-map-field').screenshot({ path: `${root}/map-${name}.png` });
  if (width < 700)
    await page.getByRole('button', { name: 'Search city observations', exact: true }).click();
  const search = page.getByRole('searchbox', {
    name: 'Search observations and districts',
    exact: true,
  });
  await search.fill('smoke');
  await expect(page.locator('.observation-row')).toHaveCount(1);
  await expect(page.locator('.map-record-marker')).toHaveCount(1);
  await expect(page.locator('.geospatial-heading')).toContainText('1 VISIBLE SIGNALS');
  await search.fill('');
  await expect(page.locator('.observation-row')).toHaveCount(8);
  if (width < 700) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '06:00 IST', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.observation-row')).toHaveCount(2);
  await page.getByRole('button', { name: '15:00 IST', exact: true }).click();
  await expect(page.locator('.observation-row')).toHaveCount(8);
  await page.getByRole('button', { name: /^Analytics/ }).click();
  await expect(page.locator('.analytics-grid .chart')).toHaveCount(4);
  const chart = page.locator('.chart').first();
  await chart.getByRole('button', { name: 'Data table', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(chart.locator('tbody tr')).toHaveCount(5);
  await chart.getByRole('button', { name: 'Chart', exact: true }).click();
  await chart.locator('.chart-current-point').waitFor();
  const before = Number(await chart.locator('.chart-current-point').getAttribute('cx'));
  const cursorStart = await page.evaluate(() => window.__cinemaSamples.length);
  await chart.getByRole('button', { name: 'View 06:00 IST snapshot', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(850);
  const after = Number(await chart.locator('.chart-current-point').getAttribute('cx'));
  assert(Math.abs(after - before) > 20, name + ' chart follows selected recorded snapshot');
  const cursor = await page.evaluate(
    (start) =>
      window.__cinemaSamples
        .slice(start)
        .map((v) => v.chartX)
        .filter(Boolean),
    cursorStart,
  );
  const chartStates = new Set(cursor).size;
  if (reducedMotion === 'no-preference')
    assert(chartStates > 1, name + ' chart cursor visibly animates');
  await page.locator('.analytics-grid').screenshot({ path: `${root}/analytics-${name}.png` });
  await page.getByRole('button', { name: /^Twin/ }).click();
  await page.locator('.command-twin canvas').waitFor();
  targets(await boxes(page, '.command-twin .city-layer-controls button'));
  if (width < 700) grid(await boxes(page, '.command-twin .city-layer-controls button'));
  await page.getByLabel('Camera preset').selectOption('central');
  await page.getByRole('button', { name: 'Switch to day lighting', exact: true }).click();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await noOverflow(page);
  return {
    chartStates,
    chartCursor: { before, after },
    observationDetails: 'metadata / evidence / replay / Escape and marker focus restored',
    mapLayers: width < 700 ? '2x2 / >=44px' : '44px targets',
  };
}

try {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1440, 900],
  ]) {
    if (selectedWidth && width !== selectedWidth) continue;
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const name = `${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion,
        hasTouch: width < 960,
        isMobile: width < 700,
      });
      const page = await context.newPage();
      const errors = [],
        warnings = [],
        failed = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
        if (m.type() === 'warning') warnings.push(m.text());
      });
      page.on('requestfailed', (r) => {
        if (!r.failure()?.errorText.includes('ERR_ABORTED')) failed.push(r.url());
      });
      await page.addInitScript(() => {
        window.__cinemaSamples = [];
        setInterval(() => {
          const style = (selector) => {
            const e = document.querySelector(selector);
            return e ? getComputedStyle(e).transform : null;
          };
          if (window.__cinemaSamples.length < 1800)
            window.__cinemaSamples.push({
              t: performance.now(),
              heading: style('.cinema-title-line>span'),
              portal: style('.city-portal'),
              projection: style('.hero .projected-label'),
              module: style('.module-visual-transition'),
              shutter: style('.route-shutter'),
              chart: style('.chart svg .chart-current-point'),
              chartX: document.querySelector('.chart-current-point')?.getAttribute('cx'),
              inspection: style('.inspection-orbit'),
              droneProjection: style('.drone-scene .projected-label'),
            });
        }, 65);
      });
      if (mode === 'engineering') {
        const engineering = await verifyEngineering(page, name, reducedMotion);
        assert.deepEqual(errors, [], name + ' browser errors');
        assert.deepEqual(failed, [], name + ' network failures');
        results.push({ name, ...engineering, errors, warnings, failed });
        fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
        console.log(name + ': engineering passed');
        await context.close();
        continue;
      }
      await page.goto(`http://localhost:${port}/`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.locator('.hero canvas').waitFor();
      await expect(page.locator('.rebirth')).toHaveAttribute(
        'data-entrance',
        reducedMotion === 'reduce' ? 'static' : 'complete',
        { timeout: 15000 },
      );
      if (reducedMotion === 'no-preference') {
        await page.getByRole('button', { name: 'Replay introduction', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'playing');
        await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete', {
          timeout: 15000,
        });
      } else {
        assert(
          await page.getByRole('button', { name: 'Replay introduction', exact: true }).isDisabled(),
        );
        assert.equal(
          await page
            .locator('.cinema-title-line>span')
            .first()
            .evaluate((e) => getComputedStyle(e).transform),
          'none',
        );
      }
      const proof = await page.evaluate(() => window.__cinemaSamples);
      fs.writeFileSync(`${root}/hero-motion-${name}.json`, JSON.stringify(proof, null, 2));
      const states = (field) => new Set(proof.map((v) => v[field]).filter(Boolean)).size;
      if (reducedMotion === 'no-preference') {
        assert(states('heading') > 1, name + ' heading visibly moves');
        assert(states('portal') > 1, name + ' city entrance visibly moves');
        assert(states('projection') > 1, name + ' camera changes projected city positions');
      } else {
        assert.equal(states('heading'), 1, name + ' reduced heading stable');
        assert.equal(states('portal'), 1, name + ' reduced city frame stable');
      }
      await noOverflow(page);
      if (width >= 961) {
        const [copy] = await boxes(page, '.cinema-copy');
        const [footer] = await boxes(page, '.cinema-footer');
        assert(footer.y - copy.y - copy.height >= 16, name + ' hero control separation');
        assert(
          footer.y + footer.height <= height + 0.01,
          name + ' hero footer fits ' + JSON.stringify(footer),
        );
      }
      if (width < 700) grid(await boxes(page, '.hero-layer-shortcuts button'));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: `${root}/hero-${name}.png` });
      const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Explore AETHER' })).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Experience navigation' }).getByRole('link'),
      ).toHaveCount(4);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Explore AETHER' })).toHaveCount(0);
      await expect(menu).toBeFocused();
      const signal = page.locator('.intelligence-trigger');
      await signal.focus();
      await page.keyboard.press('Enter');
      await expect(signal).toHaveAttribute('aria-expanded', 'true');
      const inspect = page.locator('.hero-signal-list button').first();
      await inspect.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.observation-detail')).toContainText('Demo aerial dataset');
      await expect(page.locator('.detail-location')).toContainText(/° N.*° E/);
      await page.keyboard.press('Escape');
      await expect(page.locator('.observation-detail')).toHaveCount(0);
      await expect(inspect).toBeFocused();
      await signal.click();
      const tour = page.getByRole('button', { name: /Watch the guided experience/ });
      await tour.click();
      await expect(page.getByRole('dialog', { name: 'The city is alive.' })).toBeVisible();
      await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Movement becomes meaning.' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.locator('#city').scrollIntoViewIfNeeded();
      await page.locator('.story-stage canvas').waitFor();
      await page.waitForTimeout(600);
      if (width < 700) grid(await boxes(page, '.story-chapters button'));
      for (const label of ['Intelligence network', 'Mobility', 'Surface heat', 'Water systems']) {
        const b = page
          .locator('.story-chapters')
          .getByRole('button', { name: new RegExp(label + '$') });
        await b.focus();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await expect(b).toHaveAttribute('aria-pressed', 'true');
      }
      await page.locator('.story-sticky').screenshot({ path: `${root}/city-${name}.png` });
      const aqua = page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true });
      await aqua.click();
      await expect(page.locator('.orbit-module-copy h3')).toHaveText(/AETHER\s*AQUA/);
      await aqua.focus();
      await page.keyboard.press('ArrowRight');
      await expect(
        page.getByRole('button', { name: 'Explore AETHER ROAD', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.orbit-module-copy h3')).toHaveText(/AETHER\s*ROAD/);
      await page.waitForTimeout(700);
      targets(await boxes(page, '.constellation button'));
      await noOverflow(page);
      await page.locator('.module-explorer-heading').scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      await page.locator('#modules').screenshot({
        path: `${root}/modules-${name}.png`,
        style: '.cinema-nav,.skip-link { visibility: hidden !important; }',
      });
      await page.getByRole('link', { name: 'Enter AETHER command', exact: true }).focus();
      await page.keyboard.press('Enter');
      if (reducedMotion === 'no-preference')
        await expect(page.locator('.route-transition')).toHaveAttribute(
          'data-transition',
          'travelling',
        );
      await page.waitForURL(`http://localhost:${port}/command`, { timeout: 60000 });
      await expect(page.getByRole('heading', { name: 'AETHER COMMAND', exact: true })).toBeVisible();
      await expect(page.locator('.route-transition')).toHaveAttribute('data-transition', 'idle');
      const routeProof = await page.evaluate(() => window.__cinemaSamples);
      const shutterStates = new Set(routeProof.map((v) => v.shutter).filter(Boolean)).size;
      const moduleStates = new Set(routeProof.map((v) => v.module).filter(Boolean)).size;
      if (reducedMotion === 'no-preference')
        assert(shutterStates > 2, name + ' route shutter visibly animates');
      if (reducedMotion === 'no-preference')
        assert(moduleStates > 1, name + ' module selection visibly animates');
      let commandProof, engineeringProof;
      if (mode === 'full') {
        commandProof = await verifyCommand(page, name, width, reducedMotion);
        engineeringProof = await verifyEngineering(page, name, reducedMotion);
      }
      assert.deepEqual(errors, [], name + ' browser errors');
      assert.deepEqual(failed, [], name + ' failed requests');
      const entry = {
        name,
        headingStates: states('heading'),
        cityFrameStates: states('portal'),
        cameraProjectionStates: states('projection'),
        routeShutterStates: shutterStates,
        moduleSelectionStates: moduleStates,
        commandProof,
        engineeringProof,
        errors,
        warnings,
        failed,
      };
      results.push(entry);
      fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
      fs.writeFileSync(`${root}/motion-samples-${name}.json`, JSON.stringify(routeProof, null, 2));
      console.log(name + ': passed ' + JSON.stringify(entry));
      await context.close();
    }
  }
} finally {
  await browser.close();
}
