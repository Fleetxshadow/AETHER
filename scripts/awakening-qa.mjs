import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
const base = process.env.NEXUS_QA_URL || 'http://localhost:3001';
const root = 'docs/awakening/validation';
const storyTitles = [
  'EVERY CITY LEAVES A SIGNAL.',
  'DETECTION IS ONLY THE BEGINNING.',
  'FROM INFORMATION TO INTELLIGENT ACTION.',
];
const mock = process.argv.includes('--mock');
const selectedWidth = Number(process.argv.find((a) => a.startsWith('--width='))?.split('=')[1]);
await fs.mkdir(root + '/screenshots', { recursive: true });
const sdk = await fs.readFile('tests/fixtures/google-maps-api.js', 'utf8');
const clean = (value) =>
  String(value)
    .replace(/AIza[\w-]+/g, '[redacted]')
    .replace(/https?:\/\/[^\s)]+/g, (value) => {
      try {
        const u = new URL(value);
        return u.origin + u.pathname;
      } catch {
        return '[URL]';
      }
    });
const reportFile = root + (mock ? '/mock.json' : '/real.json');
let previous = null;
if (selectedWidth) {
  try {
    previous = JSON.parse(await fs.readFile(reportFile, 'utf8'));
  } catch {
    /* First selected run. */
  }
}
const report = {
  mode: mock ? 'Google SDK test double' : 'Actual Google Maps',
  cases: previous?.cases.filter((c) => c.width !== selectedWidth) || [],
  checks: previous?.checks || [],
  failures: [],
};
const browser = await chromium.launch({ channel: 'chrome' });
const sizes = [
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1440, 900],
  [844, 390],
  [1280, 600],
].filter(([w]) => !selectedWidth || w === selectedWidth);
const noOverflow = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
const save = () => fs.writeFile(reportFile, JSON.stringify(report, null, 2));
async function targets(page, selector) {
  const small = await page.locator(selector).evaluateAll((nodes) =>
    nodes
      .filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width && b.height && (b.width < 43.9 || b.height < 43.9);
      })
      .map((e) => e.textContent),
  );
  expect(small).toEqual([]);
}
try {
  for (const [width, height] of sizes)
    for (const reducedMotion of height < 700 ? ['no-preference'] : ['no-preference', 'reduce']) {
      const name = `${width}x${height}-${reducedMotion}`;
      const record = width === 1440 && reducedMotion === 'no-preference';
      const context = await browser.newContext({
        viewport: { width, height },
        reducedMotion,
        ...(record
          ? { recordVideo: { dir: root + '/motion', size: { width: 1440, height: 900 } } }
          : {}),
      });
      await context.addCookies([{ name: 'nexus-theme', value: 'eclipse', url: base }]);
      const page = await context.newPage(),
        errors = [],
        network = [];
      const result = { width, height, reducedMotion, passed: false };
      page.on('pageerror', (e) => errors.push(clean(e.message)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(clean(m.text()));
      });
      page.on('requestfailed', (r) => {
        if (r.failure()?.errorText !== 'net::ERR_ABORTED')
          network.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText });
      });
      if (mock)
        await page.route('https://maps.googleapis.com/maps/api/js?**', (r) =>
          r.fulfill({ contentType: 'application/javascript', body: sdk }),
        );
      await page.addInitScript(() => {
        window.awakeningTrace = [];
        window.awakeningLongTasks = [];
        new PerformanceObserver((list) =>
          window.awakeningLongTasks.push(...list.getEntries().map((e) => e.duration)),
        ).observe({ type: 'longtask', buffered: true });
        let previous = -1;
        new MutationObserver(() => {
          const node = document.querySelector('.genesis');
          if (!node) return;
          const scene = Number(node.dataset.genesisScene);
          if (scene === previous) return;
          previous = scene;
          const heading = document.querySelector('.genesis-story h2')?.getBoundingClientRect(),
            actions = document.querySelector('.genesis-top')?.getBoundingClientRect();
          window.awakeningTrace.push({
            scene,
            at: performance.now(),
            canvasCount: document.querySelectorAll('canvas').length,
            heading: heading?.toJSON(),
            actions: actions?.toJSON(),
            projection:
              document.querySelector('.hero [data-point=central]')?.getAttribute('style') || '',
          });
        }).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-genesis-scene'],
        });
      });
      try {
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        if (reducedMotion === 'no-preference') {
          await expect(page.locator('.genesis')).toBeVisible({ timeout: 20000 });
          await targets(page, '.genesis button,.genesis-actions a');
          await noOverflow(page);
          await expect(page.locator('.genesis')).toHaveCount(0, { timeout: 25000 });
          result.scenes = await page.evaluate(() => window.awakeningTrace);
          expect(result.scenes.map((s) => s.scene)).toEqual([0, 1, 2, 3, 4, 5, 6]);
          expect(result.scenes.every((s) => s.canvasCount <= 1)).toBe(true);
          result.introRenderer = result.scenes.some((s) => s.scene >= 2 && s.canvasCount === 1)
            ? 'WebGL city'
            : 'Simplified city plan';
          await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
        } else {
          await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'static');
          await expect(page.locator('.genesis')).toHaveCount(0);
          await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
          await expect(page.locator('.genesis')).toHaveAttribute('data-playback', 'reading');
          for (let i = 1; i < 7; i++) {
            await page.getByRole('button', { name: 'Next opening scene', exact: true }).click();
            await expect(page.locator('.genesis')).toHaveAttribute('data-genesis-scene', String(i));
            await noOverflow(page);
          }
          await page.screenshot({ path: `${root}/screenshots/${name}-reading.png` });
          await page.getByRole('button', { name: 'Finish opening story', exact: true }).click();
        }
        await page
          .getByRole('heading', { name: 'AETHER CITY', exact: true })
          .scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/screenshots/${name}-hero.png` });
        await targets(
          page,
          '.hero-layer-shortcuts button,.intelligence-trigger,.cinema-replay button',
        );
        if (width === 390) {
          const b = await page.locator('.hero-layer-shortcuts button').evaluateAll((nodes) =>
            nodes.map((e) => {
              const b = e.getBoundingClientRect();
              return { x: b.x, y: b.y };
            }),
          );
          expect(Math.abs(b[0].y - b[1].y)).toBeLessThan(1);
          expect(b[2].y).toBeGreaterThan(b[0].y);
          expect(Math.abs(b[2].y - b[3].y)).toBeLessThan(1);
        }
        await page.locator('.intelligence-trigger').click();
        await page.locator('.hero-signal-list button').first().click();
        await expect(page.locator('.observation-detail')).toBeVisible();
        await page.getByRole('button', { name: 'Close observation details', exact: true }).click();
        await page.locator('.intelligence-trigger').click();
        await page.locator('.city-portal').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/screenshots/${name}-city.png` });
        await page.locator('.story-stage').scrollIntoViewIfNeeded();
        for (let i = 0; i < 3; i++) {
          await page.locator('.story-chapters button').nth(i).click();
          await expect(page.locator('#city')).toHaveAttribute('data-story-step', String(i));
          await expect(page.locator('.story-narrative h2')).toHaveText(storyTitles[i]);
          await expect(page.locator('.story-narrative')).toHaveCSS('opacity', '1');
          if (await page.locator('#city').evaluate((e) => e.classList.contains('static-story'))) {
            await page
              .locator('.story-narrative h2')
              .evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
          }
          await page.screenshot({ path: `${root}/screenshots/${name}-chapter-${i}.png` });
          await page.locator('.story-stage').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${root}/screenshots/${name}-chapter-${i}-scene.png` });
        }
        await targets(
          page,
          '.story-chapters button,.city-layer-controls button,.city-camera-controls button,.city-camera-controls select',
        );
        await page.locator('#geography').scrollIntoViewIfNeeded();
        const map = page.locator('#geography .aether-operational-map');
        await expect(map).toHaveAttribute('data-map-state', 'ready', { timeout: 60000 });
        await map.getByRole('button', { name: 'Satellite', exact: true }).click();
        await expect(map.getByRole('button', { name: 'Satellite', exact: true })).toHaveAttribute(
          'aria-pressed',
          'true',
        );
        await map.getByRole('button', { name: 'Roadmap', exact: true }).click();
        await map.getByRole('button', { name: 'Google traffic', exact: true }).click();
        await expect(
          map.getByRole('button', { name: 'Google traffic', exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await map.getByRole('button', { name: 'Google traffic', exact: true }).click();
        await targets(page, '#geography .aether-map-toolbar button');
        await noOverflow(page);
        await map.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${root}/screenshots/${name}-map.png` });
        if (reducedMotion === 'reduce') {
          const audit = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(
            audit.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
            })),
          ).toEqual([]);
        }
        result.performance = await page.evaluate(() => ({
          domReadyMs: Math.round(
            performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
          ),
          longTasks: window.awakeningLongTasks.length,
          maxLongTaskMs: Math.round(Math.max(0, ...window.awakeningLongTasks)),
        }));
        expect(errors).toEqual([]);
        expect(network).toEqual([]);
        result.consoleErrors = errors;
        result.networkFailures = network;
        result.passed = true;
        console.log('PASS ' + name);
      } catch (e) {
        result.failure = clean(e.stack || e);
        report.failures.push({ name, error: result.failure });
        console.error('FAIL ' + name + ' ' + clean(e.message));
        await page.screenshot({ path: `${root}/screenshots/${name}-failure.png` }).catch(() => {});
      } finally {
        const video = page.video();
        await context.close();
        if (video) await video.saveAs(root + '/motion/awakening-walkthrough.webm');
        report.cases.push(result);
        await save();
      }
    }
  if (!selectedWidth)
    for (const theme of ['original', 'aqua', 'spectrum', 'sage']) {
      const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          reducedMotion: 'reduce',
        }),
        page = await context.newPage();
      await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
      if (mock)
        await page.route('https://maps.googleapis.com/maps/api/js?**', (r) =>
          r.fulfill({ contentType: 'application/javascript', body: sdk }),
        );
      try {
        await page.goto(base + '/');
        await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'static');
        await page.screenshot({ path: `${root}/screenshots/theme-${theme}.png` });
        await noOverflow(page);
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        report.checks.push({ theme, accessibility: 'passed' });
        console.log('PASS theme ' + theme);
      } catch (e) {
        report.failures.push({ theme, error: clean(e.stack || e) });
        console.error('FAIL theme ' + theme + ' ' + clean(e.message));
      } finally {
        await context.close();
        await save();
      }
    }
  if (!selectedWidth) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    if (mock)
      await page.route('https://maps.googleapis.com/maps/api/js?**', (r) =>
        r.fulfill({ contentType: 'application/javascript', body: sdk }),
      );
    await page.addInitScript(() => {
      window.cinematicAudioStarts = 0;
      const Original = window.AudioContext;
      if (Original)
        window.AudioContext = class extends Original {
          constructor(...args) {
            super(...args);
            window.cinematicAudioStarts++;
          }
        };
    });
    try {
      await page.goto(base + '/');
      await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'static');
      expect(await page.evaluate(() => window.cinematicAudioStarts)).toBe(0);
      await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
      await page.getByRole('button', { name: 'Enable cinematic sound', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.cinematicAudioStarts)).toBe(1);
      await page.getByRole('button', { name: 'Mute cinematic sound', exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.genesis')).toHaveCount(0);
      report.checks.push({
        name: 'Sound remains silent until explicit consent; mute and Escape work',
        passed: true,
      });
      await page.goto(base + '/command/response');
      await page.getByRole('button', { name: 'Simulate incoming call', exact: true }).click();
      await page.getByRole('button', { name: 'Accept demo', exact: true }).click();
      await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
      await expect(page.locator('.simulated-channel-disclosure')).toContainText(
        'No phone/audio connection',
      );
      await expect(page.locator('.demo-conversation')).toContainText(
        'simulated waterlogging report',
      );
      await expect(
        page.getByRole('button', { name: 'Start microphone', exact: true }),
      ).toBeDisabled();
      await page.getByRole('button', { name: 'End demo call', exact: true }).click();
      await expect(page.locator('.response-state')).toHaveText('ended');
      report.checks.push({
        name: 'RESPONSE demo call, simulated transcript and End Demo Call preserved',
        passed: true,
      });
      console.log('PASS opt-in sound and RESPONSE compatibility');
    } catch (e) {
      report.failures.push({ check: 'sound/RESPONSE', error: clean(e.stack || e) });
      console.error(clean(e.message));
    } finally {
      await context.close();
      await save();
    }
  }
  if (!selectedWidth) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      reducedMotion: 'no-preference',
      recordVideo: { dir: root + '/motion', size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage(),
      errors = [];
    let sdkLoads = 0;
    await context.addCookies([{ name: 'nexus-theme', value: 'aqua', url: base }]);
    page.on('pageerror', (e) => errors.push(clean(e.message)));
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/maps/api/js') sdkLoads++;
    });
    if (mock)
      await page.route('https://maps.googleapis.com/maps/api/js?**', (r) =>
        r.fulfill({ contentType: 'application/javascript', body: sdk }),
      );
    try {
      await page.goto(base + '/');
      await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete', {
        timeout: 30000,
      });
      await expect(page.locator('.city-portal')).toHaveCSS('overflow', 'hidden');
      expect(
        await page.locator('.city-portal').evaluate((e) => getComputedStyle(e).borderTopLeftRadius),
      ).not.toBe('0px');
      await page.screenshot({ path: root + '/screenshots/theme-aqua-normal.png' });
      await page.locator('#geography').scrollIntoViewIfNeeded();
      await expect(page.locator('#geography .aether-operational-map')).toHaveAttribute(
        'data-map-state',
        'ready',
        { timeout: 60000 },
      );
      await page
        .locator('.hero')
        .getByRole('link', { name: 'Enter AETHER command', exact: true })
        .click();
      await expect(page).toHaveURL(/\/command$/);
      await expect(page.locator('.route-transition')).toHaveAttribute('data-transition', 'idle');
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        'ready',
        { timeout: 60000 },
      );
      expect(errors).toEqual([]);
      expect(sdkLoads).toBe(1);
      report.checks.push({
        name: 'Aqua normal-motion curved frame, COMMAND transition and one SDK load across both maps',
        passed: true,
      });
      console.log('PASS Aqua frame and COMMAND transition');
    } catch (e) {
      report.failures.push({ check: 'Aqua/COMMAND transition', error: clean(e.stack || e) });
      console.error(clean(e.message));
    } finally {
      const video = page.video();
      await context.close();
      if (video) await video.saveAs(root + '/motion/aqua-command-transition.webm');
      await save();
    }
  }
} finally {
  await browser.close();
  await save();
  if (report.failures.length || report.cases.some((c) => !c.passed)) process.exitCode = 1;
}
