import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('1. First visit to http://localhost:3001/...');
  await page.goto('http://localhost:3001/');
  
  const intro = page.getByRole('dialog', { name: 'AETHER introduction film' });
  await intro.waitFor({ state: 'visible', timeout: 10000 });
  console.log('PASS: Intro film dialog is visible on first visit!');

  console.log('2. Skipping intro film...');
  await page.locator('.aether-intro-skip').click();
  await intro.waitFor({ state: 'hidden', timeout: 5000 });
  console.log('PASS: Intro film dismissed cleanly!');

  console.log('3. Reloading page (simulating returning / refreshing)...');
  await page.reload();
  
  await intro.waitFor({ state: 'visible', timeout: 10000 });
  console.log('PASS: Intro film dialog opens AGAIN on return/reload!');

  await page.screenshot({ path: 'docs/hero-blender-check/intro-on-repeat.png' });
  console.log('Screenshot saved to docs/hero-blender-check/intro-on-repeat.png');
} finally {
  await browser.close();
}
