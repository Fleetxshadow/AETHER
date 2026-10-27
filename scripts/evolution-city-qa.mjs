import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
fs.mkdirSync('docs/evolution/city-stage', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = [];
try {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1440, 900],
  ]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto('http://localhost:3000/');
      await page.locator('.city-scene canvas').first().waitFor();
      await page.waitForTimeout(2400);
      const geometry = await page.evaluate(() => {
        const rect = (s) => document.querySelector(s)?.getBoundingClientRect().toJSON();
        const markers = [...document.querySelectorAll('.city-scene .scene-marker')]
          .filter((e) => getComputedStyle(e).visibility === 'visible')
          .map((e) => ({
            label: e.getAttribute('aria-label'),
            ...e.getBoundingClientRect().toJSON(),
          }));
        const overlap = markers.some((a, i) =>
          markers
            .slice(i + 1)
            .some(
              (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
            ),
        );
        return {
          copy: rect('.cinema-copy'),
          city: rect('.city-portal'),
          dock: rect('.observatory-dock'),
          footer: rect('.cinema-footer'),
          markers,
          overlap,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(geometry.overlap).toBe(false);
      expect(geometry.overflow).toBe(false);
      expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.footer.top);
      const name = `${width}-${reducedMotion}`;
      await page
        .locator('.cinematic-hero')
        .screenshot({ path: `docs/evolution/city-stage/${name}.png` });
      await page.goto('http://localhost:3000/command');
      await page.locator('.map-record-marker').first().waitFor();
      await page.waitForTimeout(1200);
      const map = await page
        .locator('.map-record-marker')
        .evaluateAll((els) =>
          els
            .filter((e) => getComputedStyle(e).visibility === 'visible')
            .map((e) => e.getBoundingClientRect().toJSON()),
        );
      expect(
        map.some((a, i) =>
          map
            .slice(i + 1)
            .some(
              (b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
            ),
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
      results.push({ name, geometry, map, errors });
      console.log(`${name}: passed`);
      await context.close();
    }
  }
} finally {
  fs.writeFileSync('docs/evolution/city-stage/results.json', JSON.stringify(results, null, 2));
  await browser.close();
}
