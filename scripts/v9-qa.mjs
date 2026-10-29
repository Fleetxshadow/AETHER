import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const base = process.env.NEXUS_QA_URL || 'http://localhost:3001';
const output = 'docs/v9/validation';
const widthFilter = Number(process.argv.find((a) => a.startsWith('--width='))?.split('=')[1]);
const themesOnly = process.argv.includes('--themes-only');
const reportPath = output + '/results.json';
await fs.mkdir(output + '/screenshots', { recursive: true });
let previous;
if (widthFilter || themesOnly) {
  try {
    previous = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  } catch {
    /* First selected run. */
  }
}
const report = {
  mode: 'Production browser / actual Google Maps',
  cases: previous?.cases.filter((c) => c.width !== widthFilter) || [],
  themes: themesOnly ? [] : previous?.themes || [],
  failures: [],
};
const clean = (value) =>
  String(value)
    .replace(/AIza[\w-]+/g, '[redacted]')
    .replace(/https?:\/\/[^\s)]+/g, (value) => {
      try {
        const url = new URL(value);
        return url.origin + url.pathname;
      } catch {
        return '[URL]';
      }
    });
const save = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2));
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
async function targets(page, selector) {
  const small = await page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const r = node.getBoundingClientRect();
        return r.width && r.height && (r.width < 43.9 || r.height < 43.9);
      })
      .map((node) => node.textContent),
  );
  expect(small).toEqual([]);
}
async function accessibility(page) {
  const result = await new AxeBuilder({ page })
    .include('#main')
    .exclude('.gm-style')
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({ target: n.target, reason: n.failureSummary })),
  }));
}
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const sizes = [
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1440, 900],
    [844, 390],
    [1280, 600],
  ].filter(([w]) => !themesOnly && (!widthFilter || w === widthFilter));
  for (const [width, height] of sizes)
    for (const reducedMotion of height < 700 ? ['no-preference'] : ['no-preference', 'reduce']) {
      const name = `${width}x${height}-${reducedMotion}`;
      const recording = reducedMotion === 'no-preference' && [390, 1440].includes(width);
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion,
        ...(recording
          ? {
              recordVideo: {
                dir: output + '/motion',
                size: width === 390 ? { width, height } : { width: 960, height: 600 },
              },
            }
          : {}),
      });
      await context.addCookies([{ name: 'nexus-theme', value: 'eclipse', url: base }]);
      const page = await context.newPage();
      const errors = [],
        network = [];
      page.on('pageerror', (error) => errors.push(clean(error.message)));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(clean(message.text()));
      });
      page.on('requestfailed', (request) => {
        if (request.failure()?.errorText !== 'net::ERR_ABORTED')
          network.push({
            path: new URL(request.url()).pathname,
            error: request.failure()?.errorText,
          });
      });
      await page.addInitScript(() => {
        window.v9Scenes = [];
        window.v9LongTasks = [];
        window.v9ProjectionStates = [];
        new PerformanceObserver((list) =>
          window.v9LongTasks.push(...list.getEntries().map((e) => e.duration)),
        ).observe({ type: 'longtask', buffered: true });
        let previous = -1;
        new MutationObserver(() => {
          const node = document.querySelector('.genesis');
          if (!node) return;
          const scene = Number(node.dataset.genesisScene);
          if (scene === previous) return;
          previous = scene;
          const canvas = document.querySelector('.hero canvas');
          window.v9Scenes.push({
            scene,
            at: performance.now(),
            renderer: document.querySelector('.hero')?.dataset.cinematicRenderer,
            canvas: canvas?.getBoundingClientRect().toJSON(),
            canvasCount: document.querySelectorAll('.hero canvas').length,
          });
        }).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-genesis-scene'],
        });
        setInterval(() => {
          const scene = Number(
            document.querySelector('.genesis')?.getAttribute('data-genesis-scene') ?? -1,
          );
          if (scene < 1 || scene > 6) return;
          const positions = [...document.querySelectorAll('.hero .projected-label')]
            .map((e) => e.getAttribute('style') || '')
            .join('|');
          if (positions) window.v9ProjectionStates.push(positions);
        }, 80);
      });
      const result = { width, height, reducedMotion, passed: false };
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        if (reducedMotion === 'no-preference') {
          await expect(page.locator('.genesis')).toBeVisible({ timeout: 20000 });
          await targets(page, '.genesis button,.genesis-actions a');
          await expect(page.locator('.genesis')).toHaveCount(0, { timeout: 30000 });
          await expect(page.locator('.rebirth:visible')).toHaveAttribute(
            'data-entrance',
            'complete',
          );
          result.opening = await page.evaluate(() => ({
            scenes: window.v9Scenes,
            cameraStates: new Set(window.v9ProjectionStates).size,
          }));
          expect(result.opening.scenes.map((s) => s.scene)).toEqual([0, 1, 2, 3, 4, 5, 6]);
          expect(result.opening.scenes.every((s) => s.canvasCount <= 1)).toBe(true);
        } else {
          await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'static');
          await expect(page.locator('.genesis')).toHaveCount(0);
          await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
          await expect(page.locator('.genesis')).toHaveAttribute('data-playback', 'reading');
          for (let i = 1; i < 7; i++) {
            await page.getByRole('button', { name: 'Next opening scene', exact: true }).click();
            await expect(page.locator('.genesis')).toHaveAttribute('data-genesis-scene', String(i));
          }
          await page.screenshot({ path: `${output}/screenshots/${name}-reading.png` });
          await page.getByRole('button', { name: 'Finish opening story', exact: true }).click();
        }
        await noOverflow(page);
        await page
          .getByRole('heading', { name: 'AETHER CITY', exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/screenshots/${name}-hero.png` });
        await targets(
          page,
          '.hero-layer-shortcuts button,.intelligence-trigger,.cinema-replay button',
        );
        if (width === 390) {
          const rows = await page
            .locator('.hero-layer-shortcuts button')
            .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().y));
          expect(Math.abs(rows[0] - rows[1])).toBeLessThan(1);
          expect(rows[2]).toBeGreaterThan(rows[0]);
          expect(Math.abs(rows[2] - rows[3])).toBeLessThan(1);
        }
        await page.locator('.intelligence-trigger').click();
        await page.locator('.hero-signal-list button').first().click();
        await expect(page.locator('.observation-detail')).toBeVisible();
        await page.getByRole('button', { name: 'Close observation details', exact: true }).click();
        await page.locator('.intelligence-trigger').click();

        for (let i = 0; i < 5; i++) {
          await page.locator('.story-worlds button').nth(i).click();
          if (reducedMotion === 'no-preference') await page.waitForTimeout(900);
          await expect(page.locator('#city')).toHaveAttribute('data-environment', String(i));
          await expect(page.locator('.story-worlds button').nth(i)).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          await expect(page.locator('.world-caption')).toContainText('SIMULATED');
          if (width === 1440 && reducedMotion === 'no-preference') {
            await page.waitForTimeout(800);
            await page.screenshot({ path: `${output}/screenshots/${name}-world-${i}.png` });
          }
        }
        await page.locator('.story-worlds button').first().click();
        await expect(page.locator('#city')).toHaveAttribute('data-environment', '0');
        await page.locator('.story-worlds button').nth(2).click();
        if (width <= 1000 || height <= 660 || reducedMotion === 'reduce')
          await page.locator('.story-stage').scrollIntoViewIfNeeded();
        if (reducedMotion === 'no-preference') await page.waitForTimeout(1000);
        await expect(page.locator('#city')).toHaveAttribute('data-environment', '2');
        await page.screenshot({ path: `${output}/screenshots/${name}-water.png` });
        await targets(
          page,
          '.story-chapters button,.story-worlds button,.city-layer-controls button,.story-intelligence summary',
        );

        await page.locator('#engineering').scrollIntoViewIfNeeded();
        await expect(page.locator('.sky-reel-caption')).toBeVisible();
        for (let i = 0; i < 4; i++) {
          await page
            .getByRole('button', { name: new RegExp('^Drone view ' + (i + 1) + ':') })
            .click();
          await expect(page.locator('.sky-reel-caption')).toHaveAttribute(
            'data-reel-step',
            String(i),
          );
          if (width === 1440 && reducedMotion === 'no-preference') {
            await page.locator('.engineering-configurator').scrollIntoViewIfNeeded();
            await page.waitForTimeout(650);
            await page.screenshot({ path: `${output}/screenshots/${name}-drone-${i}.png` });
          }
        }
        await page
          .locator('#engineering')
          .getByRole('button', { name: 'Exploded view', exact: true })
          .click();
        await expect(page.locator('#engineering .drone-scene')).toHaveAttribute(
          'data-exploded',
          'true',
        );
        await page
          .locator('#engineering')
          .getByRole('button', { name: '03 Modular energy pack', exact: true })
          .click();
        await expect(page.locator('#engineering .engineering-configurator')).toHaveAttribute(
          'data-inspection',
          '03',
        );
        await page
          .locator('#engineering')
          .getByRole('button', { name: 'Reset engineering view', exact: true })
          .click();
        await expect(page.locator('#engineering .drone-scene')).toHaveAttribute(
          'data-exploded',
          'false',
        );
        await targets(
          page,
          '.reel-actions button,#engineering .part-list button,#engineering .assembly-switch button',
        );
        await page.locator('.engineering-configurator').scrollIntoViewIfNeeded();
        if (reducedMotion === 'no-preference') await page.waitForTimeout(1800);
        await page.screenshot({ path: `${output}/screenshots/${name}-drone.png` });

        await page.locator('#geography').scrollIntoViewIfNeeded();
        const map = page.locator('#geography .aether-operational-map');
        await expect(map).toHaveAttribute('data-map-state', 'ready', { timeout: 60000 });
        for (const mode of ['Satellite', 'Roadmap']) {
          await map.getByRole('button', { name: mode, exact: true }).click();
          await expect(map.getByRole('button', { name: mode, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
        }
        await map.getByRole('button', { name: 'Google traffic', exact: true }).click();
        await expect(
          map.getByRole('button', { name: 'Google traffic', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await map.getByRole('button', { name: 'Google traffic', exact: true }).click();
        await page.locator('#geography .handoff-map-frame').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/screenshots/${name}-map.png` });
        result.accessibility = await accessibility(page);
        expect(result.accessibility).toEqual([]);
        await noOverflow(page);
        result.performance = await page.evaluate(() => ({
          domReadyMs: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd,
          longTasks: window.v9LongTasks.length,
          maxLongTaskMs: Math.max(0, ...window.v9LongTasks),
        }));
        if (width === 1440 && reducedMotion === 'no-preference') {
          await page
            .getByRole('link', { name: 'Review paths & affected areas', exact: true })
            .click();
          await expect(page).toHaveURL(/\/command\/geo$/);
          await expect(page.locator('.aether-operational-map:visible')).toHaveAttribute(
            'data-map-state',
            'ready',
            { timeout: 60000 },
          );
          const sdkCount = await page.evaluate(
            () =>
              [...document.scripts].filter((s) => s.src.includes('maps.googleapis.com/maps/api/js'))
                .length,
          );
          expect(sdkCount).toBe(1);
          result.commandHandoff = { passed: true, sdkCount };
        }
        result.consoleErrors = errors;
        result.networkFailures = network;
        expect(errors).toEqual([]);
        expect(network).toEqual([]);
        result.passed = true;
        console.log('PASS ' + name);
      } catch (error) {
        result.error = clean(error.message);
        result.consoleErrors = errors;
        result.networkFailures = network;
        report.failures.push(name);
        console.log('FAIL ' + name + ': ' + clean(error.message).slice(0, 1500));
        await page
          .screenshot({ path: `${output}/screenshots/${name}-failure.png` })
          .catch(() => {});
      } finally {
        report.cases.push(result);
        await context.close();
        if (recording) await page.video().saveAs(`${output}/motion/${name}.webm`);
        await save();
      }
    }
  if (!widthFilter)
    for (const theme of ['original', 'aqua', 'spectrum', 'sage']) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        reducedMotion: 'reduce',
      });
      await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
      const page = await context.newPage();
      try {
        await page.goto(base);
        await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'static');
        const heroInk = await page
          .locator('.cinema-title-line > span')
          .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).color));
        expect(heroInk).toEqual(['rgb(243, 248, 250)', 'rgb(105, 227, 209)']);
        const violations = await accessibility(page);
        expect(violations).toEqual([]);
        await noOverflow(page);
        await page.screenshot({ path: `${output}/screenshots/theme-${theme}.png` });
        report.themes.push({ theme, passed: true, heroInk });
        console.log('PASS theme ' + theme);
      } catch (error) {
        report.themes.push({ theme, passed: false, error: clean(error.message) });
        report.failures.push('theme-' + theme);
      } finally {
        await context.close();
        await save();
      }
    }
} finally {
  await browser.close();
}
report.failures = [
  ...report.cases.filter((c) => !c.passed).map((c) => `${c.width}x${c.height}-${c.reducedMotion}`),
  ...report.themes.filter((c) => !c.passed).map((c) => 'theme-' + c.theme),
];
await save();
if (report.failures.length) process.exitCode = 1;
