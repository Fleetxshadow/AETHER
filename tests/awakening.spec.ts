import { test, expect } from '@playwright/test';
import { installGoogleMapsDouble } from './map-setup';

test.beforeEach(async ({ page }) => installGoogleMapsDouble(page));

test('fresh Genesis runs seven scenes with visible camera motion and hands one renderer to the hero', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const events: { scene: number; at: number; projection: string }[] = [];
    const projections: string[] = [];
    Object.assign(window, { awakeningEvents: events, awakeningProjections: projections });
    const sample = setInterval(() => {
      const node = document.querySelector<HTMLElement>('.genesis');
      const scene = node ? Number(node.dataset.genesisScene) : -1;
      // V9 includes low road-level shots; sample the complete camera journey.
      if (scene < 1 || scene > 6) return;
      const field = Array.from(document.querySelectorAll('.hero .projected-label'))
        .map((e) => e.getAttribute('style') || '')
        .join('|');
      if (field) projections.push(field);
    }, 80);
    let previous = -1;
    const observer = new MutationObserver(() => {
      const node = document.querySelector<HTMLElement>('.genesis');
      const scene = node ? Number(node.dataset.genesisScene) : -1;
      if (!node && previous >= 0) clearInterval(sample);
      if (scene >= 0 && previous !== scene) {
        previous = scene;
        events.push({
          scene,
          at: performance.now(),
          projection:
            document.querySelector('.hero [data-point=central]')?.getAttribute('style') || '',
        });
      }
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-genesis-scene'],
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // The flight hero is the opening; Genesis now plays on request.
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'AETHER Genesis experience' })).toBeVisible();
  await expect(page.locator('.experience-content')).toHaveAttribute('inert');
  await expect(page.locator('.hero canvas')).toHaveCount(1);
  await expect(page.locator('.genesis')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  const events = await page.evaluate(
    () =>
      (
        window as unknown as {
          awakeningEvents: { scene: number; at: number; projection: string }[];
        }
      ).awakeningEvents,
  );
  expect(events.map((e) => e.scene)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  const projections = await page.evaluate(
    () => (window as unknown as { awakeningProjections: string[] }).awakeningProjections,
  );
  expect(new Set(projections).size).toBeGreaterThan(5);
  // First signal includes actual renderer readiness; the remaining story clock
  // must run at its designed speed without dropping scenes during shader startup.
  expect(events[6].at - events[1].at).toBeGreaterThan(5000);
  expect(events[6].at - events[1].at).toBeLessThan(9000);
  await test.info().attach('genesis-motion-evidence', {
    body: Buffer.from(
      JSON.stringify({ events, cameraProjectionStates: new Set(projections).size }),
    ),
    contentType: 'application/json',
  });
  await expect(page.locator('.hero canvas')).toHaveCount(1);
  await expect(page.locator('.cinema-title-line > span').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.experience-content')).not.toHaveAttribute('inert');
  expect(errors).toEqual([]);
});

test('keyboard skip, returning visit and replay preserve immediate operational navigation', async ({
  page,
}) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'AETHER Genesis experience' });
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Skip Intro', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Enter command', exact: true }).click();
  await expect(page).toHaveURL(/\/command$/);
  await expect(page.getByRole('heading', { name: 'AETHER COMMAND', exact: true })).toBeVisible();
});

test('reduced motion has a complete manual opening story without automatic playback', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'static');
  await expect(page.locator('.genesis')).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(page.locator('.genesis')).toHaveAttribute('data-playback', 'reading');
  for (let i = 1; i <= 6; i++) {
    await page.getByRole('button', { name: 'Next opening scene', exact: true }).click();
    await expect(page.locator('.genesis')).toHaveAttribute('data-genesis-scene', String(i));
  }
  await page.getByRole('button', { name: 'Finish opening story', exact: true }).click();
  await expect(page.locator('.genesis')).toHaveCount(0);
  await expect(page.locator('.hero h1')).toBeVisible();
});
