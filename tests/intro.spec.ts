import { test, expect, type Page } from '@playwright/test';
import { installGoogleMapsDouble } from './map-setup';

// First-visit intro film: Blender-exported city + drone, original soundtrack, skippable.
test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => installGoogleMapsDouble(page));

const filmClock = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('.aether-intro-progress b');
    const match = bar && /scaleX\(([\d.]+)\)/.exec(bar.style.transform);
    return match ? Number(match[1]) * 17 : -1;
  });

test('first visit plays the real-time 3D film, skips cleanly and never returns', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  const assets = new Map<string, number>();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => {
    if (/\/(models\/intro|audio|draco)\//.test(r.url()))
      assets.set(new URL(r.url()).pathname, r.status());
  });
  await page.goto('/');
  const intro = page.getByRole('dialog', { name: 'AETHER introduction film' });
  await expect(intro).toBeVisible();
  await expect(page.locator('.experience-content')).toHaveAttribute('inert', '');
  await expect(intro.getByRole('status')).toContainText(/Real-time 3D city ready/i, {
    timeout: 120000,
  });
  await expect(page.getByRole('button', { name: 'Enter AETHER' })).toBeFocused();
  // Enter, confirm playback and skip in one in-page step: under software WebGL on a loaded
  // machine each Playwright round trip can take seconds, and the film is only 17 s long.
  const playing = await page.evaluate(
    () =>
      new Promise<{ clock: number; canvas: boolean; mute: boolean }>((resolve) => {
        document.querySelector<HTMLButtonElement>('.aether-intro-enter')?.click();
        const check = () => {
          const root = document.querySelector('.aether-intro');
          const bar = document.querySelector<HTMLElement>('.aether-intro-progress b');
          const match = bar && /scaleX\(([\d.]+)\)/.exec(bar.style.transform);
          const clock = match ? Number(match[1]) * 17 : -1;
          if (root && clock < 0.5) return void setTimeout(check, 20);
          resolve({
            clock,
            canvas: !!root?.querySelector('canvas'),
            mute: !!document.querySelector('button[aria-label="Mute intro sound"]'),
          });
          document.querySelector<HTMLButtonElement>('.aether-intro-skip')?.click();
        };
        check();
      }),
  );
  expect(playing.clock).toBeGreaterThanOrEqual(0.5);
  expect(playing.clock).toBeLessThan(16);
  expect(playing.canvas).toBe(true);
  expect(playing.mute).toBe(true);
  await expect(intro).toHaveCount(0);
  for (const path of [
    '/models/intro/aether-city.glb',
    '/models/intro/aether-drone.glb',
    '/audio/aether-intro.mp3',
    '/draco/draco_decoder.wasm',
  ])
    expect(assets.get(path), path).toBe(200);
  await expect(page.locator('.experience-content')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.flight')).toBeVisible();
  expect(errors).toEqual([]);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'fresh');
  await expect(page.locator('.aether-intro')).toBeVisible();
});

test('reduced motion never autoplays; on request it is a still-frame film', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'seen');
  await expect(page.locator('.aether-intro')).toHaveCount(0);
  await page.goto('/?intro');
  const intro = page.getByRole('dialog', { name: 'AETHER introduction film' });
  await expect(intro.getByRole('status')).toContainText(/still-frame/i);
  await expect(intro.locator('canvas')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(intro).toHaveCount(0);
});

test('without WebGL the intro falls back to the Blender still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
  const intro = page.getByRole('dialog', { name: 'AETHER introduction film' });
  await expect(intro).toHaveAttribute('data-mode', 'poster');
  await expect(intro.getByRole('status')).toContainText(/3D unavailable/i);
  await page.getByRole('button', { name: 'Enter AETHER' }).click();
  await expect.poll(() => filmClock(page)).toBeGreaterThan(0.5);
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await expect(intro).toHaveCount(0);
});

test('the film can be replayed from the footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await expect(page.locator('.aether-intro')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay intro film' }).click();
  const intro = page.getByRole('dialog', { name: 'AETHER introduction film' });
  await expect(intro).toBeVisible();
  await page.getByRole('button', { name: /Skip intro/ }).click();
  await expect(intro).toHaveCount(0);
});
