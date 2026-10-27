import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { installGoogleMapsDouble } from './map-setup';

async function command(page: Page) {
  await page.goto('/command');
  await expect(page.getByRole('heading', { name: 'AETHER COMMAND', exact: true })).toBeVisible();
  await expect(page.locator('.observation-row')).toHaveCount(8);
}
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  await installGoogleMapsDouble(page);
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => {
  expect(errors, 'No unhandled runtime errors').toEqual([]);
});

test('cinematic entry, introduction skip, orbit and guided presentation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /AETHER CITY/ })).toBeVisible();
  await expect(page.locator('.hero canvas')).toBeVisible();
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
  const skip = page.getByRole('button', { name: 'Skip intro' });
  await expect(page.getByRole('button', { name: 'Replay introduction' })).toBeVisible();
  await page.getByRole('button', { name: 'Replay introduction' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'playing');
  await page.keyboard.press('Enter');
  await expect(skip).toHaveCount(0);
  await page.screenshot({ path: 'docs/cinematic/tests/landing-desktop.png' });
  await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).click();
  await expect(page.locator('.orbit-module-copy h3')).toHaveText('AETHER AQUA');
  await page.getByRole('button', { name: /Watch the guided experience/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Movement becomes meaning.' })).toBeVisible();
  await page.getByRole('button', { name: 'Play presentation' }).click();
  await page.getByRole('button', { name: 'Pause presentation' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .locator('.hero')
    .getByRole('link', { name: 'Enter AETHER command', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'AETHER COMMAND', exact: true })).toBeVisible();
});
test('map, details, replay, historical selection and focus modes stay connected', async ({
  page,
}) => {
  await command(page);
  await expect(page.locator('.aether-operational-map')).toHaveAttribute(
    'data-map-state',
    /missing|ready/,
  );
  await page.screenshot({ path: 'docs/cinematic/tests/command-desktop.png', fullPage: true });
  const ready =
    (await page.locator('.aether-operational-map').getAttribute('data-map-state')) === 'ready';
  expect(await page.getByRole('button', { name: 'Zoom map in', exact: true }).isEnabled()).toBe(
    ready,
  );
  await page.getByRole('checkbox', { name: 'AETHER FIRE layer', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'AETHER FIRE layer', exact: true }).check();
  await page.locator('.geo-demo-switch input').check();
  await page.locator('.observation-row').filter({ hasText: 'Smoke signature detected' }).click();
  await expect(
    page
      .locator('.observation-detail')
      .getByRole('heading', { name: 'Smoke signature detected', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.aether-map-selection')).toContainText(
    'DEMO · Smoke signature detected',
  );
  await page.getByRole('button', { name: 'Review detection replay' }).click();
  await page.getByRole('button', { name: 'Play detection replay' }).click();
  await expect(page.getByRole('button', { name: 'Pause detection replay' })).toBeVisible();
  await page.getByRole('button', { name: 'Pause detection replay' }).click();
  await page.getByRole('button', { name: '06:00 IST', exact: true }).click();
  await expect(page.locator('.observation-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Close observation details' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Analytics mode' }).click();
  await expect(page.locator('.analytics-grid .chart')).toHaveCount(4);
  await page.locator('.chart').first().getByRole('button', { name: 'Data table' }).click();
  await expect(page.locator('.chart').first().getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'Twin mode' }).click();
  await expect(page.locator('.command-twin .aether-operational-map')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Satellite', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('.command-twin').screenshot({ path: 'docs/cinematic/tests/twin-desktop.png' });
  await expect(page.locator('.command-twin canvas')).toHaveCount(0);
});
test('ten modules navigate and expose distinct controls', async ({ page }) => {
  await command(page);
  for (const id of [
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
  ]) {
    await page
      .getByRole('navigation', { name: 'AETHER modules' })
      .getByRole('link', { name: new RegExp(`^${id.toUpperCase()} `) })
      .click();
    await expect(
      page.getByRole('heading', {
        name: id === 'command' ? 'AETHER COMMAND' : `AETHER ${id.toUpperCase()}`,
        exact: true,
      }),
    ).toBeVisible();
    if (id === 'sky') {
      await page.getByRole('button', { name: 'Exploded view' }).click();
      await expect(page.getByRole('button', { name: 'Exploded view' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.getByRole('button', { name: /Modular energy pack/ }).click();
      await expect(page.locator('.part-detail')).toContainText('removable energy');
      await expect(page.locator('.drone-scene [data-point=battery]')).toBeVisible();
      await page
        .locator('.engineering-explorer')
        .screenshot({ path: 'docs/cinematic/tests/drone-exploded.png' });
    }
    if (id === 'flow') {
      await page.getByLabel('INTERSECTION').selectOption('north');
      await page.getByRole('button', { name: 'Compare baseline' }).click();
      await expect(page.getByRole('button', { name: 'Hide baseline' })).toBeVisible();
    }
    if (id === 'rescue') {
      await page.getByRole('button', { name: 'Mark demo observation reviewed' }).click();
      await expect(page.getByRole('button', { name: 'Reviewed locally' })).toBeDisabled();
      await page.keyboard.press('Escape');
    }
    if (id === 'thermal') {
      await page.getByRole('button', { name: 'Green corridor', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Green corridor', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
    }
    if (id === 'aqua') await expect(page.locator('.water-tank')).toContainText('28.6');
    if (id === 'road') {
      await page.getByRole('slider', { name: 'Road evidence comparison' }).focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('slider', { name: 'Road evidence comparison' })).toHaveValue(
        '51',
      );
    }
    if (id === 'fire') {
      await page.getByRole('slider', { name: /Detection confidence threshold/ }).fill('99');
      await expect(page.getByRole('main').getByRole('status')).toContainText(
        'No demo detection above threshold',
      );
    }
    if (id === 'core') {
      await page.getByRole('button', { name: 'What is happening with traffic?' }).click();
      await expect(page.locator('.core-sources')).toContainText('NX-2402');
      await expect(page.locator('.core-sources')).not.toContainText('NX-2405');
    }
  }
});
test('palette keyboard navigation, settings persistence and exports', async ({ page }) => {
  await command(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'System settings', exact: true }).click();
  await page.getByRole('button', { name: /Simplified Accessible plan/ }).click();
  await page.getByRole('checkbox', { name: 'Enable optional audio' }).check();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Enable optional audio' })).toBeChecked();
  await expect(page.getByRole('button', { name: /Simplified Accessible plan/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page
    .getByRole('navigation', { name: 'AETHER modules' })
    .getByRole('link', { name: /^TWIN / })
    .click();
  await expect(page.locator('.command-twin .aether-operational-map')).toHaveAttribute(
    'data-map-state',
    /missing|ready/,
  );
  await page.reload();
  await expect(page.locator('.command-twin .aether-operational-map')).toHaveAttribute(
    'data-map-state',
    /missing|ready/,
  );
  await expect(page.locator('.command-twin canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Generate summary' }).click();
  await expect(page.locator('.generated-report')).toContainText('8 observations');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const path = await download.path();
  const payload = JSON.parse(await readFile(path!, 'utf8'));
  expect(payload.source).toBe('DEMO');
  expect(payload.observations).toHaveLength(8);
  await page.getByLabel('REPORT SCOPE').selectOption('day');
  await expect(page.locator('.report-table tbody tr')).toHaveCount(9);
});
test('service errors retry cleanly', async ({ page }) => {
  await page.route('**/api/observations', (route) =>
    route.fulfill({ status: 503, body: 'offline' }),
  );
  await page.goto('/command');
  await expect(page.getByRole('heading', { name: 'Demo service is offline.' })).toBeVisible();
  await page.unroute('**/api/observations');
  await page.getByRole('button', { name: 'Retry data connection' }).click();
  await expect(page.locator('.observation-row')).toHaveCount(8);
});
test('WebGL failure preserves accessible data exploration', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(
    page.locator('.hero').getByText('WebGL unavailable · simplified city plan', { exact: true }),
  ).toBeVisible();
  await page.goto('/command/twin');
  await expect(page.locator('.command-twin .aether-operational-map')).toHaveAttribute(
    'data-map-state',
    /missing|ready/,
  );
  await expect(page.locator('.observation-row')).toHaveCount(8);
  await page.locator('.observation-row').first().click();
  await expect(page.getByRole('button', { name: 'Close observation details' })).toBeVisible();
});
test('desktop and mobile layouts pass core accessibility checks', async ({ page }) => {
  // Five full axe scans plus the 3D flight opening exceed 60 s under software WebGL.
  test.slow();
  for (const path of ['/', '/command', '/command/sky', '/command/core']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === '/')
      await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
    else await expect(page.locator('.panel-loading')).toHaveCount(0);
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(scan.violations, `${path} accessibility`).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await command(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Search city observations' }).click();
  await page.getByLabel('Search observations and districts').fill('Smoke');
  await expect(page.locator('.observation-row')).toHaveCount(1);
  await page.getByLabel('Search observations and districts').fill('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Search city observations' })).toBeFocused();
  await page.getByRole('button', { name: 'Open command navigation' }).click();
  await page.getByRole('link', { name: /^SKY / }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AETHER SKY');
  const scan = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(scan.violations).toEqual([]);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The city hero now follows the flight opening.
  await page.locator('.hero').scrollIntoViewIfNeeded();
  await expect(page.locator('.hero [data-point=central]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'docs/cinematic/tests/landing-mobile.png', fullPage: true });
});

test('reduced motion keeps manual exploration usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Replay introduction' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Skip intro' })).toHaveCount(0);
  await page.getByRole('button', { name: /Watch the guided experience/ }).click();
  await expect(page.getByRole('button', { name: 'Play presentation' })).toBeDisabled();
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Movement becomes meaning.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Watch the guided experience/ })).toBeFocused();
});

test('map fallback preserves severity and keyboard observation selection', async ({ page }) => {
  await command(page);
  await expect(page.getByLabel('Severity legend')).toContainText(/critical/i);
  const marker = page.locator('.observation-row').filter({ hasText: 'Smoke signature detected' });
  await marker.focus();
  await page.keyboard.press('Tab');
  await marker.focus();
  await expect(page.locator('.aether-map-pin')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close observation details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close observation details' })).toHaveCount(0);
  await expect(marker).toBeFocused();
  await page.getByRole('button', { name: '06:00 IST', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.aether-map-pin')).toHaveCount(0);
  await expect(page.locator('.geo-record-row')).toHaveCount(0);
  await expect(page.locator('.observation-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Retract sidebar' }).click();
  await expect(page.locator('.os-app')).toHaveClass(/sidebar-collapsed/);
});

test('scroll narrative changes the city layer and reduced motion keeps it manual', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
  await page.locator('#city').scrollIntoViewIfNeeded();
  const story = page.locator('#city');
  const bounds = await story.boundingBox();
  await page.mouse.wheel(0, Math.max(800, bounds!.height * 0.45));
  await expect(story).not.toHaveAttribute('data-story-step', '0');
  await expect(page.locator('.story-narrative h2')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(story).toHaveClass(/static-story/);
  await story
    .locator('.story-chapters')
    .getByRole('button', { name: '03 ANTICIPATE', exact: true })
    .click();
  await expect(story).toHaveAttribute('data-story-step', '2');
  await expect(page.locator('.story-narrative h2')).toHaveText(
    'FROM INFORMATION TO INTELLIGENT ACTION.',
  );
});
