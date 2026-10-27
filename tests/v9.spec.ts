import { test, expect, type Page } from '@playwright/test';
import { installGoogleMapsDouble } from './map-setup';

test.use({ video: { mode: 'on', size: { width: 960, height: 600 } } });
test.beforeEach(async ({ page }) => installGoogleMapsDouble(page));

async function reelPosition(page: Page, progress: number) {
  const reel = page.locator('.sky-reel:visible');
  const bounds = await reel.boundingBox();
  expect(bounds).not.toBeNull();
  const height = page.viewportSize()!.height;
  await page.mouse.wheel(0, bounds!.y - 100 + progress * (bounds!.height - height + 100));
}
async function cameraLabel(page: Page) {
  const label = page.locator('.sky-reel:visible .projected-label[data-point="camera"]');
  await expect(label).toHaveAttribute('style', /translate/);
  const style = await label.getAttribute('style');
  const match = style!.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  expect(match).not.toBeNull();
  return match!.slice(1).map(Number);
}

test('Quad X scroll orbit reverses and manual inspection takes control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('aether-genesis-v1', 'seen'));
  await page.goto('/');
  await expect(page.locator('.rebirth:visible')).toHaveCount(1);
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
  await page.locator('#engineering:visible').scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Take manual control', exact: true }),
  ).toBeVisible();
  await reelPosition(page, 0.56);
  await expect(page.locator('.sky-reel-caption:visible')).toHaveAttribute('data-reel-step', '2');
  await page.waitForTimeout(1800);
  const before = await cameraLabel(page);
  await reelPosition(page, 0.85);
  await expect(page.locator('.sky-reel-caption:visible')).toHaveAttribute('data-reel-step', '3');
  await page.waitForTimeout(1800);
  const after = await cameraLabel(page);
  expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeGreaterThan(10);
  await reelPosition(page, 0.56);
  await expect(page.locator('.sky-reel-caption:visible')).toHaveAttribute('data-reel-step', '2');
  await page.waitForTimeout(1800);
  const reversed = await cameraLabel(page);
  expect(Math.hypot(reversed[0] - before[0], reversed[1] - before[1])).toBeLessThan(3);
  await page.getByRole('button', { name: 'Take manual control', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume scroll tour', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '03 Modular energy pack', exact: true }).click();
  await expect(page.locator('.sky-reel:visible .engineering-configurator')).toHaveAttribute(
    'data-inspection',
    '03',
  );
  await test.info().attach('reversible-camera-projections', {
    body: Buffer.from(JSON.stringify({ before, after, reversed })),
    contentType: 'application/json',
  });
});

test('opening hands the same canvas and final camera composition to the hero', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    type Boundary = {
      canvas: HTMLCanvasElement;
      rect: { x: number; y: number; width: number; height: number };
      projection: string;
    };
    const holder = window as unknown as { v9Boundary?: Boundary };
    // Capture the last rendered film frame, not a fixed delay after the
    // scene-6 DOM update: software WebGL can render that update later.
    const capture = () => {
      if (
        document.querySelector('.genesis')?.getAttribute('data-genesis-scene') === '6' &&
        document.querySelector('.rebirth[data-genesis="playing"]')
      ) {
        const hero = Array.from(document.querySelectorAll<HTMLElement>('.hero')).find(
          (el) => el.getClientRects().length > 0,
        );
        const canvas = hero?.querySelector('canvas');
        if (canvas)
          holder.v9Boundary = {
            canvas,
            rect: canvas.getBoundingClientRect().toJSON(),
            projection: hero?.querySelector('[data-point="NX-2401"]')?.getAttribute('style') || '',
          };
      }
      if (!holder.v9Boundary || document.querySelector('.genesis')) requestAnimationFrame(capture);
    };
    requestAnimationFrame(capture);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AETHER Genesis experience' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'AETHER Genesis experience' })).toHaveCount(0, {
    timeout: 25000,
  });
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
  const continuity = await page.evaluate(() => {
    const boundary = (
      window as unknown as {
        v9Boundary?: {
          canvas: HTMLCanvasElement;
          rect: { x: number; y: number; width: number; height: number };
          projection: string;
        };
      }
    ).v9Boundary;
    const canvas = Array.from(document.querySelectorAll<HTMLCanvasElement>('.hero canvas')).find(
      (el) => el.getClientRects().length > 0,
    );
    return {
      captured: !!boundary,
      sameCanvas: canvas === boundary?.canvas,
      before: boundary?.rect,
      after: canvas?.getBoundingClientRect().toJSON(),
      projectionBefore: boundary?.projection,
      projectionAfter:
        Array.from(document.querySelectorAll<HTMLElement>('.hero'))
          .find((el) => el.getClientRects().length > 0)
          ?.querySelector('[data-point="NX-2401"]')
          ?.getAttribute('style') || '',
    };
  });
  await test.info().attach('hero-handoff-continuity', {
    body: Buffer.from(JSON.stringify(continuity)),
    contentType: 'application/json',
  });
  expect(continuity.captured).toBe(true);
  expect(continuity.sameCanvas).toBe(true);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(continuity.before![key] - continuity.after![key])).toBeLessThan(0.5);
  const position = (style: string) =>
    style
      .match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
      ?.slice(1)
      .map(Number);
  const before = position(continuity.projectionBefore!),
    after = position(continuity.projectionAfter);
  expect(before).toHaveLength(2);
  expect(after).toHaveLength(2);
  expect(Math.hypot(before![0] - after![0], before![1] - after![1])).toBeLessThan(3);
});

test('evidence control stays 44px during scene transitions and supports the keyboard', async ({
  page,
}) => {
  // Assertions finish in ~20 s; finalizing this spec's video recording needs the extra budget.
  test.slow();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('aether-genesis-v1', 'seen'));
  await page.goto('/');
  await expect(page.locator('.rebirth:visible')).toHaveAttribute('data-entrance', 'complete');
  await page.locator('.story-worlds button').first().click();
  const sampling = page.evaluate(async () => {
    const sizes: { width: number; height: number }[] = [];
    const start = performance.now();
    while (performance.now() - start < 1400) {
      const summary = document.querySelector('.story-intelligence summary')!;
      const { width, height } = summary.getBoundingClientRect();
      sizes.push({ width, height });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return sizes;
  });
  await page.locator('.story-worlds button').nth(2).click();
  const sizes = await sampling;
  await test.info().attach('animated-target-sizes', {
    body: Buffer.from(JSON.stringify(sizes)),
    contentType: 'application/json',
  });
  expect(sizes.length).toBeGreaterThan(1);
  expect(
    Math.min(...sizes.map((size) => Math.min(size.width, size.height))),
  ).toBeGreaterThanOrEqual(43.9);
  await expect(page.locator('#city')).toHaveAttribute('data-environment', '2');
  const summary = page.locator('.story-intelligence summary');
  await summary.focus();
  await summary.press('Enter');
  await expect(page.locator('.story-intelligence')).not.toHaveAttribute('open', '');
  await summary.press('Enter');
  await expect(page.locator('.story-intelligence')).toHaveAttribute('open', '');
});
