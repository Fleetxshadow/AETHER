import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = 'docs/polish';
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const selectedWidth = Number(process.argv[2]);
const results = selectedWidth
  ? JSON.parse(fs.readFileSync(`${root}/results.json`, 'utf8')).filter(
      (r) => !r.name.startsWith(`${selectedWidth}x`),
    )
  : [];
const assemblies = [
  ['airframe', '01', 'Carbon composite airframe'],
  ['propulsion', '02', 'Brushless propulsion'],
  ['battery', '03', 'Modular energy pack'],
  ['camera', '04', 'Multisensor gimbal'],
  ['controller', '05', 'Flight & sensor computer'],
];
async function layout(page, selector) {
  return page.locator(selector).evaluateAll((elements) =>
    elements.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        font: parseFloat(getComputedStyle(el).fontSize),
      };
    }),
  );
}
function targets(buttons) {
  for (const b of buttons) assert(b.width >= 44 && b.height >= 44, JSON.stringify(b));
}
function grid(buttons) {
  assert.equal(buttons.length, 4);
  assert(Math.abs(buttons[0].y - buttons[1].y) < 1);
  assert(Math.abs(buttons[2].y - buttons[3].y) < 1);
  assert(buttons[2].y >= buttons[0].y + buttons[0].height);
  assert(buttons.every((b) => b.font >= 11));
  targets(buttons);
}
async function overflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
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
      await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
      await page.locator('.hero canvas').waitFor();
      await expect(page.locator('.rebirth')).toHaveAttribute(
        'data-entrance',
        reducedMotion === 'reduce' ? 'static' : 'complete',
      );
      await overflow(page);
      const hero = await layout(page, '.rebirth-hero-copy,.hero-horizon,.hero-instrument');
      const copy = hero[0],
        instrument = hero[1],
        horizon = hero[2];
      if (width >= 961) {
        assert(horizon.y - (copy.y + copy.height) >= 16, name + ' hero copy / telemetry gap');
        assert(horizon.y + horizon.height <= height, name + ' telemetry fits viewport');
        assert(instrument.y + instrument.height < horizon.y, name + ' instrument / telemetry gap');
      }
      if (width < 700) grid(await layout(page, '.hero-layer-shortcuts button'));
      await page.screenshot({ path: `${root}/hero-${name}.png` });
      if (reducedMotion === 'reduce') {
        assert(await page.getByRole('button', { name: 'Replay introduction' }).isDisabled());
        assert(
          await page
            .locator('.living-story')
            .evaluate((el) => el.classList.contains('static-story')),
        );
        const heading = await page.locator('.hero-word>span').evaluate((el) => ({
          transform: getComputedStyle(el).transform,
          opacity: getComputedStyle(el).opacity,
        }));
        assert.deepEqual(heading, { transform: 'none', opacity: '1' });
      }
      await page.locator('#city').scrollIntoViewIfNeeded();
      await page.locator('.story-stage canvas').waitFor();
      await page.waitForTimeout(600);
      if (width < 700) grid(await layout(page, '.story-chapters button'));
      for (const label of ['Intelligence network', 'Mobility', 'Surface heat', 'Water systems']) {
        const b = page
          .locator('.story-chapters')
          .getByRole('button', { name: new RegExp(label + '$') });
        await b.focus();
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await expect(b).toHaveAttribute('aria-pressed', 'true');
        const boxes = await layout(page, '.story-copy,.story-chapters');
        assert(
          boxes[1].y + boxes[1].height <= boxes[0].y + boxes[0].height,
          name + ' chapters fit narrative',
        );
      }
      await page
        .locator('.story-chapters')
        .getByRole('button', { name: /Intelligence network$/ })
        .click();
      await expect(page.locator('.story-chapters button').first()).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.waitForTimeout(500);
      const sceneLabels = await layout(
        page,
        '.story-stage .scene-marker,.story-stage .landmark-label',
      );
      assert(sceneLabels.length > 0 && sceneLabels.every((b) => b.font >= 11));
      targets(sceneLabels.filter((b) => /^24/.test(b.text)));
      await page.locator('.story-sticky').screenshot({ path: `${root}/city-${name}.png` });
      // Module arrow navigation remains keyboard operated.
      const aqua = page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true });
      await aqua.click();
      await aqua.focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.orbit-module-copy h3')).toHaveText('AETHER ROAD');
      await page.goto('http://localhost:3001/command/sky', { waitUntil: 'domcontentloaded' });
      await page.locator('.drone-scene canvas').waitFor();
      for (const [id, number, label] of assemblies) {
        const b = page.locator('.part-list').getByRole('button', { name: `${number} ${label}` });
        await b.focus();
        await page.keyboard.press('Enter');
        await expect(b).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.studio-status')).toContainText(`INSPECTION / ${number}`);
        await expect(page.locator('.part-detail-index')).toHaveText(number);
        if (['battery', 'camera', 'controller'].includes(id))
          await expect(page.locator(`.drone-scene [data-point=${id}] button`)).toHaveText(
            `${number} / ${id.toUpperCase()}`,
          );
      }
      await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
      await page.waitForTimeout(1500);
      const bounds = await page.locator('.drone-scene').boundingBox();
      const callouts = await layout(page, '.drone-scene .scene-marker');
      targets(callouts);
      for (const [id, number] of assemblies.filter(([id]) =>
        ['battery', 'camera', 'controller'].includes(id),
      )) {
        const el = page.locator(`.drone-scene [data-point=${id}] button`);
        await expect(el).toHaveText(`${number} / ${id.toUpperCase()}`);
        await expect(el).toBeVisible();
        const b = await el.boundingBox();
        assert(
          b.x >= bounds.x - 2 &&
            b.y >= bounds.y - 2 &&
            b.x + b.width <= bounds.x + bounds.width + 2 &&
            b.y + b.height <= bounds.y + bounds.height + 2,
          name + ' ' + id + ' callout fits',
        );
      }
      const camera = page.locator('.drone-scene [data-point=camera] button');
      await camera.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.studio-status')).toContainText('INSPECTION / 04');
      await page.locator('.engineering-stage').screenshot({ path: `${root}/sky-${name}.png` });
      await page.getByRole('button', { name: 'Reset engineering view' }).click();
      await expect(page.locator('.studio-status')).toContainText('INSPECTION / 04');
      await overflow(page);
      await page.goto('http://localhost:3001/command/twin', { waitUntil: 'domcontentloaded' });
      await page.locator('.command-twin canvas').waitFor();
      const layers = await layout(page, '.command-twin .city-layer-controls button');
      targets(layers);
      if (width < 700) grid(layers);
      await page.getByLabel('Camera preset').selectOption('central');
      await page.goto('http://localhost:3001/command', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.observation-row')).toHaveCount(8);
      await page.locator('.map-record-marker').first().waitFor();
      await expect(page.locator('.map-severity-legend')).toContainText(
        /critical.*elevated.*normal/s,
      );
      const mapLayers = await layout(page, '.map-layers button');
      targets(mapLayers);
      if (width < 700) {
        grid(mapLayers);
        const boxes = (
          await Promise.all(
            ['.map-layers', '.map-severity-legend', '.map-summary'].map((selector) =>
              layout(page, selector),
            ),
          )
        ).flat();
        assert(boxes[1].y + boxes[1].height < boxes[0].y, name + ' legend above layers');
        assert(boxes[0].y + boxes[0].height < boxes[2].y, name + ' layers above summary');
      }
      const marker = page.getByRole('button', {
        name: 'Select Smoke signature detected, critical',
        exact: true,
      });
      assert.equal(await marker.evaluate((el) => el.tagName), 'BUTTON');
      targets(await layout(page, '.map-record-marker'));
      await marker.focus();
      await page.keyboard.press('Enter');
      await expect(marker).toHaveAttribute('aria-pressed', 'true');
      const detail = page.locator('.observation-detail');
      await expect(detail).toContainText('Smoke signature detected');
      for (const text of [
        'Confidence',
        'Observed at',
        'Source',
        'Evidence',
        'Demo aerial dataset',
        'IST',
        'Simulated observation. No real incident verified.',
      ])
        await expect(detail).toContainText(text);
      await expect(detail.locator('.detail-location')).toContainText(/° N.*° E/);
      await expect(detail.locator('.detail-description')).not.toBeEmpty();
      await expect(detail.getByRole('link', { name: 'Open AETHER FIRE' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close observation details' })).toBeFocused();
      await detail.getByRole('button', { name: 'Review detection replay' }).click();
      await expect(detail.getByRole('button', { name: 'Play detection replay' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(detail).toHaveCount(0);
      await expect(marker).toBeFocused();
      await page.locator('.command-map-stage').screenshot({ path: `${root}/map-${name}.png` });
      await page.getByRole('button', { name: '06:00 IST', exact: true }).click();
      await expect(page.locator('.observation-row')).toHaveCount(2);
      await overflow(page);
      assert.deepEqual(errors, [], name + ' fresh browser errors');
      assert.deepEqual(failed, [], name + ' failed requests');
      results.push({
        name,
        hero,
        storyLayers: width < 700 ? '2x2 / >=44px / 11px text' : 'keyboard verified',
        assemblies: '01 airframe / 02 propulsion / 03 battery / 04 camera / 05 controller',
        callouts,
        errors,
        warnings,
        failed,
      });
      fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
      console.log(
        `${name}: passed, ${errors.length} errors, ${warnings.length} warnings, ${failed.length} failed requests`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
