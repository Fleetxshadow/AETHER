import { chromium } from '@playwright/test';
import fs from 'node:fs';

const root = 'docs/hero-blender-check';
fs.mkdirSync(root, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3005',
          localStorage: [{ name: 'aether-intro-v1', value: 'seen' }],
        },
      ],
    },
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Navigating to http://localhost:3005/');
  await page.goto('http://localhost:3005/');
  await page.locator('.flight canvas').waitFor();

  // Wait for the GLTF models to load and render
  console.log('Waiting 5s for models to load and render...');
  await page.waitForTimeout(5000);

  // Capture World 01
  await page.screenshot({ path: `${root}/world-01.png` });
  console.log('Captured World 01');

  // Click World 02
  const world2Btn = page.locator('.flight-world[data-world="grid"]');
  await world2Btn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${root}/world-02.png` });
  console.log('Captured World 02');

  // Click World 03
  const world3Btn = page.locator('.flight-world[data-world="coast"]');
  await world3Btn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${root}/world-03.png` });
  console.log('Captured World 03');

  // Mobile viewport
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3005',
          localStorage: [{ name: 'aether-intro-v1', value: 'seen' }],
        },
      ],
    },
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3005/');
  await mobilePage.locator('.flight canvas').waitFor();
  await mobilePage.waitForTimeout(5000);
  await mobilePage.screenshot({ path: `${root}/mobile.png` });
  console.log('Captured Mobile');

  console.log('Errors:', errors);
} finally {
  await browser.close();
}
