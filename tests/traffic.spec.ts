import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { installGoogleMapsDouble } from './map-setup';

async function start(page: Page) {
  await page.goto('/traffic');
  await page.getByRole('button', { name: 'Start private demo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'City traffic intelligence', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.traffic-map-wrap .aether-operational-map')).toBeVisible();
}
async function act(page: Page, label: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/response/traffic?') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: label, exact: true }).click(),
  ]);
  expect(await response.json()).not.toHaveProperty('error');
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
}
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  await installGoogleMapsDouble(page);
  await mkdir('docs/traffic/screenshots', { recursive: true });
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => expect(errors, 'No unhandled browser errors').toEqual([]));

test('complete human-reviewed traffic workflow, public feed, voice controls and recovery', async ({
  page,
}) => {
  await start(page);
  await mkdir('docs/traffic/screenshots', { recursive: true });
  await page.screenshot({
    path: 'docs/traffic/screenshots/before-observations.png',
    fullPage: true,
  });
  await expect(
    page.getByRole('button', { name: /Golf Course Road NORTHBOUND · UNKNOWN/ }),
  ).toBeVisible();
  await act(page, 'Normal readings');
  await expect(
    page.getByRole('button', { name: /Golf Course Road NORTHBOUND · NORMAL/ }),
  ).toBeVisible();
  await act(page, 'Generate sustained slowdown');
  await expect(
    page.getByRole('heading', { name: 'Cause remains unknown.', exact: true }),
  ).toBeVisible();
  await act(page, 'Run CORE analysis');
  await expect(page.locator('.traffic-inspection')).toContainText('recommended');
  await expect(
    page.getByRole('button', { name: 'Begin operator review', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('textbox', { name: 'Private operator review notes' })
    .fill('Reviewed synthetic evidence and planning feasibility. No real flight.');
  await act(page, 'Begin operator review');
  await act(page, 'Approve for operator planning');
  await expect(page.getByRole('button', { name: 'Link labeled demo observation' })).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'I am linking the original synthetic sample, with no actual flight claimed.',
    })
    .check();
  await act(page, 'Link labeled demo observation');
  await expect(
    page.getByRole('img', { name: /DEMO original synthetic obstruction/ }),
  ).toBeVisible();
  await act(page, 'Analyze available evidence');
  await expect(page.locator('.traffic-finding')).toContainText('not pixel inference');
  await act(page, 'Approve public-safe summary');
  await expect(page.locator('.traffic-phone article')).toContainText('unknown');
  await expect(page.locator('.traffic-phone article')).not.toContainText('breakdown');
  await page
    .getByRole('checkbox', {
      name: 'I inspected the labeled evidence and understand its uncertainty.',
    })
    .check();
  await act(page, 'Confirm sample finding');
  await expect(page.locator('.traffic-cause')).toContainText('VERIFIED / VERIFIED');
  await expect(
    page.locator('.traffic-phone article'),
    'previous publication withdrawn on verification change',
  ).toHaveCount(0);
  await act(page, 'Approve public-safe summary');
  await expect(page.locator('.traffic-phone article')).toContainText('breakdown');
  await expect(page.getByRole('button', { name: 'Listen to approved alert' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Enable browser voice for approved updates' }).check();
  await expect(page.getByRole('button', { name: 'Listen to approved alert' })).toBeEnabled();
  await page.getByRole('button', { name: 'Switch to demo alternative' }).click();
  await expect(page.locator('.traffic-phone article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Keep current route' }).click();
  await expect(page.getByRole('button', { name: 'Return to original route' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Return to original route' }).click();
  await expect(page.locator('.traffic-phone article')).toContainText('breakdown');
  await page.getByRole('button', { name: 'Play incident history' }).click();
  await expect(page.locator('.traffic-playback')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve public-safe summary' })).toBeDisabled();
  await page.getByRole('button', { name: 'Return to current' }).click();
  await page.screenshot({
    path: 'docs/traffic/screenshots/after-approved-investigation.png',
    fullPage: true,
  });
  await act(page, 'Generate sustained recovery');
  await expect(page.locator('.traffic-investigation .traffic-chip').first()).toHaveText('RESOLVED');
  await expect(page.locator('.traffic-phone article')).toContainText('Traffic recovery');
});

test('API rejects cross-origin, anonymous, invalid, oversized, stale and LIVE demo actions; sessions isolated', async ({
  playwright,
  baseURL,
}) => {
  const client = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL! },
    }),
    other = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL! },
    });
  try {
    expect((await (await client.get('/api/response/traffic')).json()).authorized).toBe(false);
    expect(
      (
        await client.post('/api/response/traffic', {
          data: { action: 'analyze', expectedRevision: 0, incidentId: 'missing' },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await client.post('/api/response/traffic', {
          headers: { Origin: 'https://untrusted.example' },
          data: { action: 'start-demo' },
        })
      ).status(),
    ).toBe(403);
    const initial = await (
      await client.post('/api/response/traffic', { data: { action: 'start-demo' } })
    ).json();
    expect(initial.state.source).toBe('DEMO');
    expect(initial.state).not.toHaveProperty('windows');
    expect(initial.state).not.toHaveProperty('seenIds');
    expect(
      (
        await client.post('/api/response/traffic', {
          data: { action: 'demo-observations', phase: 'slow', expectedRevision: 99 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await client.post('/api/response/traffic', { data: { action: 'start-demo' } })).status(),
    ).toBe(409);
    expect(
      (
        await client.post('/api/response/traffic', {
          data: '{broken',
          headers: { 'Content-Type': 'application/json' },
        })
      ).status(),
    ).toBe(400);
    expect((await client.post('/api/response/traffic', { data: 'x'.repeat(13000) })).status()).toBe(
      413,
    );
    expect(
      (
        await client.post('/api/response/traffic?source=LIVE', { data: { action: 'start-demo' } })
      ).status(),
    ).toBe(401);
    const changed = await (
      await client.post('/api/response/traffic', {
        data: {
          action: 'demo-observations',
          phase: 'slow',
          expectedRevision: initial.state.revision,
        },
      })
    ).json();
    expect(changed.state.incidents).toHaveLength(1);
    const id = changed.state.incidents[0].id;
    const published = await client.post('/api/response/traffic', {
      data: { action: 'publish', expectedRevision: changed.state.revision, incidentId: id },
    });
    expect(published.ok()).toBe(true);
    const url =
      '/api/response/traffic/public?segments=demo-gcr-n1&networkVersion=nexus-gurugram-sketch-v1';
    const feed = await (await client.get(url)).json();
    expect(feed.incidents).toHaveLength(1);
    expect(feed.incidents[0].cause).toBe('UNKNOWN');
    expect(feed.incidents[0]).not.toHaveProperty('siteId');
    expect(feed.incidents[0]).not.toHaveProperty('notes');
    expect((await other.get(url)).status()).toBe(401);
    await other.post('/api/response/traffic', { data: { action: 'start-demo' } });
    expect((await (await other.get(url)).json()).incidents).toHaveLength(0);
    const stale = await client.post('/api/response/traffic', {
      data: {
        action: 'demo-observations',
        phase: 'advance',
        expectedRevision: (await published.json()).state.revision,
      },
    });
    expect(stale.ok()).toBe(true);
    expect((await (await client.get(url)).json()).incidents).toHaveLength(0);
  } finally {
    await client.dispose();
    await other.dispose();
  }
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
])
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`responsive map, keyboard and controls ${viewport.width}x${viewport.height} ${reducedMotion}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion });
      await start(page);
      await act(page, 'Generate sustained slowdown');
      await expect(page.locator('.aether-operational-map')).toHaveAttribute(
        'data-map-state',
        /ready|missing/,
      );
      const ready =
        (await page.locator('.aether-operational-map').getAttribute('data-map-state')) === 'ready';
      expect(await page.getByRole('button', { name: 'Zoom map in' }).isEnabled()).toBe(ready);
      expect(
        await page.getByRole('button', { name: 'Reset map camera to Gurugram' }).isEnabled(),
      ).toBe(ready);
      await page.getByRole('button', { name: 'Recurrence', exact: true }).click();
      expect(await page.getByRole('button', { name: 'Satellite', exact: true }).isEnabled()).toBe(
        ready,
      );
      const road = page.getByRole('button', { name: /NH 48 reference corridor NORTHBOUND/ });
      await road.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('heading', { name: 'NH 48 reference corridor', exact: true }),
      ).toBeVisible();
      await page.getByRole('checkbox', { name: 'Show simulated corridors' }).focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('checkbox', { name: 'Show simulated corridors' })).toBeChecked();
      await page.keyboard.press('+');
      await page.getByRole('searchbox', { name: 'Search roads' }).fill('Sohna');
      await expect(page.locator('.traffic-road-list button')).toHaveCount(1);
      await page.getByRole('searchbox', { name: 'Search roads' }).fill('');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const targets = await page
        .locator(
          '.traffic-toolbar button,.traffic-toolbar input,.traffic-toolbar select,.aether-map-toolbar button',
        )
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      expect(targets.every((h) => h >= 44)).toBe(true);
      await page.locator('.traffic-map-section').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `docs/traffic/screenshots/map-${viewport.width}x${viewport.height}-${reducedMotion}.png`,
      });
      if (reducedMotion === 'reduce')
        expect(
          await page
            .locator('.traffic-hour-chart i')
            .first()
            .evaluate((el) => getComputedStyle(el).transitionDuration),
        ).toBe('0s');
      await page.context().setOffline(true);
      await expect(page.locator('.traffic-status')).toContainText('Offline');
      await page.context().setOffline(false);
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(page.locator('.traffic-status')).toContainText('Synced');
    });
  }

test('five themes, visible focus, accessibility and fresh console/network check', async ({
  page,
}) => {
  const consoleErrors: string[] = [],
    badRequests: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) badRequests.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await start(page);
  await act(page, 'Generate sustained slowdown');
  await act(page, 'Run CORE analysis');
  for (const name of ['Eclipse', 'Original', 'Aqua', 'Spectrum', 'Sage']) {
    await page.getByRole('button', { name: 'Open theme configurator' }).click();
    await page
      .getByRole('button', { name: new RegExp(name, 'i') })
      .filter({ has: page.locator('.theme-preview-name') })
      .click();
    await page.getByRole('button', { name: 'Close theme configurator' }).click();
    const violations = (
      await new AxeBuilder({ page })
        .include('.traffic-app')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations;
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    await page.screenshot({ path: `docs/traffic/screenshots/theme-${name.toLowerCase()}.png` });
  }
  const road = page.locator('.traffic-road-list button').first();
  await road.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(road).toBeFocused();
  expect(await road.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  expect(consoleErrors).toEqual([]);
  expect(badRequests).toEqual([]);
});
