import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const folder = 'docs/v9/proof';
await fs.mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: folder, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().replace(/key=[^&\s]+/g, 'key=REDACTED'));
  });
  await page.addInitScript(() => {
    window.filmScenes = [];
    const observer = new MutationObserver(() => {
      const el = document.querySelector('.genesis');
      const scene = el?.getAttribute('data-genesis-scene');
      if (scene !== null && scene !== undefined && window.filmScenes.at(-1)?.scene !== scene)
        window.filmScenes.push({ scene, at: performance.now() });
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-genesis-scene'],
    });
  });
  await page.goto(process.env.NEXUS_QA_URL || 'http://localhost:3002', {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('.rebirth[data-entrance="complete"]').waitFor({ timeout: 45000 });
  await page.screenshot({ path: folder + '/hero.png' });
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  for (const i of [0, 1, 2, 3]) {
    await page.waitForTimeout(1600);
    await page.screenshot({ path: folder + '/replay-' + i + '.png' });
  }
  await page.locator('.rebirth[data-entrance="complete"]').waitFor({ timeout: 25000 });
  const result = await page.evaluate(() => ({
    scenes: window.filmScenes,
    canvas: [...document.querySelectorAll('.hero canvas')].map((e) => ({
      width: e.clientWidth,
      height: e.clientHeight,
    })),
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    hero: document.querySelector('.hero').getBoundingClientRect().height,
  }));
  await fs.writeFile(folder + '/proof.json', JSON.stringify({ errors, ...result }, null, 2));
  console.log(JSON.stringify({ errors, ...result }));
  await context.close();
} finally {
  await browser.close();
}
