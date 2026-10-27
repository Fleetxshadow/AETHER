import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const base = process.env.NEXUS_QA_URL || 'http://localhost:3002';
const root = 'docs/refinements-v2/verified';
fs.mkdirSync(root, { recursive: true });
const results = { matrix: [], accessibility: [], playback: [], failureFallback: [] };
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const theme of ['original', 'aqua', 'spectrum', 'sage'])
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
    ])
      for (const reducedMotion of ['no-preference', 'reduce']) {
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
            network.push(`${r.method()} ${new URL(r.url()).pathname}: ${r.failure()?.errorText}`);
        });
        page.on('response', (r) => {
          if (r.status() >= 400) network.push(`${r.status()} ${new URL(r.url()).pathname}`);
        });
        const name = `${theme}-${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
        await page.goto(base);
        await page.locator('.cinematic-hero canvas').waitFor();
        await expect(page.locator('.rebirth')).toHaveAttribute(
          'data-entrance',
          reducedMotion === 'reduce' ? 'static' : 'complete',
        );
        const city = await page.locator('.cinematic-hero canvas').evaluate((c) => ({
          alpha: c.getContext('webgl2').getContextAttributes().alpha,
          clip: getComputedStyle(c.closest('.portal-scene-clip')).clipPath,
        }));
        expect(city.alpha).toBe(true);
        expect(city.clip).not.toBe('none');
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        await page.locator('.cinematic-hero').screenshot({ path: `${root}/hero-${name}.png` });
        await page.getByRole('button', { name: /Watch the guided experience/ }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.locator('.presentation canvas').waitFor();
        const caption = await page
          .locator('.presentation-copy>p')
          .last()
          .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
        expect(caption).toBeGreaterThanOrEqual(width < 700 ? 15 : 17);
        if (width === 1440 || width === 390)
          await page.locator('.presentation').screenshot({ path: `${root}/tour-${name}.png` });
        await page.keyboard.press('Escape');
        await page.goto(`${base}/command`);
        await page.locator('.map-record-marker').first().waitFor();
        await expect(page.locator('.telemetry-instrument')).toHaveCount(4);
        for (const annotation of await page.locator('.geospatial-heading>.mono').all())
          expect(
            await annotation.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
          ).toBeGreaterThanOrEqual(11);
        for (const panel of await page.locator('.telemetry-instrument').all()) {
          await expect(panel.locator('.kpi-context')).toContainText('06:00–18:00 IST');
          await expect(panel.locator('.kpi-context')).toContainText('Current 15:00 IST');
          await expect(panel.locator('.kpi-source')).toHaveText('SIMULATED DEMO');
          expect(
            await panel
              .locator('.kpi-source')
              .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
          ).toBeLessThanOrEqual(13);
          await expect(panel.getByRole('img')).toHaveAttribute(
            'aria-label',
            /simulated samples.*Current/,
          );
          expect(
            await panel
              .locator('.instrument-title')
              .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
          ).toBeGreaterThanOrEqual(13);
        }
        const toolbar = page.getByRole('group', { name: 'City map toolbar' });
        for (const label of ['Intelligence network', 'Mobility', 'Surface heat', 'Water systems']) {
          const control = toolbar.getByRole('button', { name: label, exact: true });
          const rect = await control.boundingBox();
          expect(rect.height).toBeGreaterThanOrEqual(44);
          expect(rect.width).toBeGreaterThanOrEqual(44);
          await control.focus();
          await page.keyboard.press('Enter');
          await expect(control).toHaveAttribute('aria-pressed', 'true');
        }
        const marker = page.locator('.map-record-marker').first();
        await marker.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.map-record-marker.selected')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(marker).toBeFocused();
        const clear = await page.evaluate(() => {
          const t = document.querySelector('.command-map-toolbar').getBoundingClientRect();
          return [...document.querySelectorAll('.map-record-marker')]
            .filter((e) => getComputedStyle(e).visibility === 'visible')
            .every((e) => {
              const r = e.getBoundingClientRect();
              return (
                r.bottom <= t.top || r.top >= t.bottom || r.right <= t.left || r.left >= t.right
              );
            });
        });
        expect(clear).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        await page.evaluate(() => {
          document.activeElement?.blur();
          scrollTo({ top: 0, behavior: 'instant' });
        });
        await page.screenshot({ path: `${root}/command-${name}.png`, fullPage: true });
        if (width === 1440 && reducedMotion === 'no-preference') {
          const audit = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          results.accessibility.push({ theme, workspace: 'command', violations: audit.violations });
        }
        await page.getByRole('button', { name: /^Analytics(?: mode)?$/ }).click();
        await expect(page.locator('.chart')).toHaveCount(4);
        await expect(page.locator('.chart-legend').first()).toContainText('06:00 IST–18:00 IST');
        await page.goto(`${base}/command/response`);
        await page.getByRole('button', { name: 'Simulate incoming call' }).click();
        await expect(page.locator('.response-state')).toHaveText('DEMO INCOMING');
        await page.getByRole('button', { name: 'Accept demo' }).click();
        await expect(page.locator('.response-state')).toHaveText('DEMO CONNECTED');
        await expect(page.locator('.simulated-channel-disclosure')).toHaveText(
          'No phone/audio connection — simulated conversation',
        );
        await expect(page.getByRole('button', { name: 'Start microphone' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Read welcome aloud' })).toBeDisabled();
        await expect(page.locator('.demo-conversation')).toContainText(
          "I've added this as a simulated waterlogging report",
        );
        await expect(page.locator('.response-detail')).toContainText('Sector 51, Gurugram');
        await expect(page.locator('.response-detail')).toContainText('FLOOD');
        await expect(page.getByLabel('Simulated caller statement (editable)')).toHaveValue(
          /road par paani/,
        );
        const record = (await (await context.request.get(`${base}/api/response`)).json())
          .incidents[0];
        expect(record.source).toBe('DEMO');
        expect(record.channel).toBe('simulated-call');
        expect(record.coordinates).toBe(null);
        expect(record.externalContactConfirmed).toBe(false);
        await expect(page.locator('.incoming-call')).toHaveCount(0);
        await page
          .locator('.response-voice-panel')
          .screenshot({ path: `${root}/call-${name}.png` });
        if (width === 1440 && reducedMotion === 'no-preference') {
          const audit = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          results.accessibility.push({
            theme,
            workspace: 'response-call',
            violations: audit.violations,
          });
        }
        await page.getByRole('button', { name: 'Play sample conversation' }).click();
        await expect(page.locator('.demo-conversation li')).toHaveCount(1);
        await page.getByRole('button', { name: 'Pause sample conversation' }).click();
        const count = await page.locator('.demo-conversation li').count();
        await page.waitForTimeout(1350);
        expect(await page.locator('.demo-conversation li').count()).toBe(count);
        await page.getByRole('button', { name: 'Restart sample conversation' }).click();
        await expect(page.locator('.demo-conversation li')).toHaveCount(1);
        await page.getByRole('button', { name: 'End demo call' }).click();
        await expect(page.locator('.response-state')).toHaveText('ended');
        const stopped = await page.locator('.demo-conversation li').count();
        await page.waitForTimeout(1350);
        expect(await page.locator('.demo-conversation li').count()).toBe(stopped);
        await expect(
          page.getByRole('button', { name: 'Restart sample conversation' }),
        ).toBeDisabled();
        expect(
          (await (await context.request.get(`${base}/api/response`)).json()).incidents,
        ).toHaveLength(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        expect(errors).toEqual([]);
        expect(network).toEqual([]);
        results.matrix.push({
          name,
          city,
          toolbarMarkersClear: clear,
          captionPx: caption,
          errors,
          network,
        });
        console.log(`${name}: passed`);
        await context.close();
      }
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto(`${base}/command/response`);
    await page.getByRole('button', { name: 'Simulate incoming call' }).click();
    await page.getByRole('button', { name: 'Accept demo' }).click();
    await expect(page.locator('.demo-conversation')).toContainText("I've added");
    await page.getByRole('button', { name: 'Restart sample conversation' }).click();
    await expect(page.locator('.demo-conversation li')).toHaveCount(4, { timeout: 10000 });
    results.playback.push({ reducedMotion, fullPlaybackComplete: true });
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base}/command/response`);
  await page.getByRole('button', { name: 'Simulate incoming call' }).click();
  await page.route('**/api/response', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Controlled demo service failure.' }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Accept demo' }).click();
  await expect(page.locator('.demo-conversation')).toContainText('could not be saved');
  await expect(page.locator('.demo-conversation')).not.toContainText("I've added");
  await page.getByRole('button', { name: 'End demo call' }).click();
  results.failureFallback.push(
    'Intentional 503: no false saved-report claim; end control stays usable.',
  );
  await context.close();
  const speechContext = await browser.newContext();
  await speechContext.addInitScript(() => {
    class Recognition {
      start() {
        window.__demoRecognition = this;
        this.onstart?.();
      }
      abort() {
        this.onend?.();
      }
    }
    window.SpeechRecognition = Recognition;
  });
  const speechPage = await speechContext.newPage();
  await speechPage.goto(`${base}/command/response`);
  await speechPage.getByRole('button', { name: 'Simulate incoming call' }).click();
  await speechPage.getByRole('button', { name: 'Accept demo' }).click();
  await expect(speechPage.locator('.demo-conversation')).toContainText("I've added");
  await speechPage.getByRole('button', { name: 'End demo call' }).click();
  await expect(speechPage.getByRole('button', { name: 'Start microphone' })).toBeDisabled();
  await speechPage.getByRole('button', { name: 'Start separate browser report' }).click();
  await expect(speechPage.getByLabel('Caller statement / live transcript')).toHaveValue('');
  await expect(speechPage.getByLabel('Incident location (optional)')).toHaveValue('');
  await speechPage.getByLabel(/I consent to browser microphone transcription/).check();
  await speechPage.getByRole('button', { name: 'Start microphone' }).click();
  await speechPage.evaluate(() =>
    window.__demoRecognition.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Medical help near clinic' } }],
    }),
  );
  await speechPage.getByRole('button', { name: 'Submit demo report' }).click();
  await expect(speechPage.locator('.response-detail')).toContainText('MEDICAL');
  const separated = (await (await speechContext.request.get(`${base}/api/response`)).json())
    .incidents;
  expect(separated).toHaveLength(2);
  const microphoneReport = separated.find((i) => i.channel === 'browser-voice');
  expect(microphoneReport.description).toBe('Medical help near clinic');
  expect(microphoneReport.location).not.toContain('Gurugram');
  results.playback.push({
    browserVoiceFixture:
      'Separate report/channel, no inherited sample statement/location; original sample preserved.',
  });
  await speechContext.close();
  expect(results.accessibility.flatMap((audit) => audit.violations)).toEqual([]);
  console.log('Refinement matrix, full transcript playback and failed-save fallback finished.');
} finally {
  fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
