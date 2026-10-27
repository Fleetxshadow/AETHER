import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = 'docs/rebirth/after';
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const result = [];
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1280, 720],
  [1440, 900],
]) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const name = `${width}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion,
      hasTouch: width < 960,
      isMobile: width < 700,
    });
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('requestfailed', (r) => {
      if (!r.failure()?.errorText.includes('ERR_ABORTED')) failed.push(r.url());
    });
    await page.addInitScript(() => {
      window.__nexusMotionProof = [];
      const timer = setInterval(() => {
        const el = document.querySelector('.hero-word>span');
        if (el)
          window.__nexusMotionProof.push({
            t: performance.now(),
            transform: getComputedStyle(el).transform,
            opacity: getComputedStyle(el).opacity,
          });
      }, 60);
      setTimeout(() => clearInterval(timer), 5000);
    });
    await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
    await page.locator('.hero canvas').waitFor();
    await page.waitForTimeout(2300);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      name + ' home overflow',
    );
    const proof = await page.evaluate(() => window.__nexusMotionProof);
    const changed = new Set(proof.map((p) => p.transform)).size;
    if (reducedMotion === 'no-preference') assert(changed > 2, name + ' heading visibly animates');
    else
      assert(
        proof.every((p) => p.transform === 'none' && p.opacity === '1'),
        name + ' reduced heading stable',
      );
    await page.screenshot({ path: `${root}/home-${name}.png` });
    if (width === 390) {
      await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
      await page
        .getByRole('navigation', { name: 'Experience navigation' })
        .getByRole('link', { name: '03 / Modules' })
        .click();
    } else await page.locator('#modules').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).click();
    await page.locator('.orbit-module-copy h3').filter({ hasText: 'AETHER AQUA' }).waitFor();
    await page.getByRole('button', { name: 'Explore AETHER AQUA', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('.orbit-module-copy h3').filter({ hasText: 'AETHER ROAD' }).waitFor();
    if (reducedMotion === 'no-preference')
      await page.locator('#modules').screenshot({ path: `${root}/modules-${width}.png` });
    await page.goto('http://localhost:3001/command', { waitUntil: 'domcontentloaded' });
    await page.locator('.observation-row').first().waitFor();
    await page.locator('.map-record-marker').first().waitFor();
    assert.equal(await page.locator('.observation-row').count(), 8);
    await page.locator('.map-severity-legend').waitFor();
    await page.locator('.observation-row').filter({ hasText: 'Smoke signature detected' }).click();
    await page.getByRole('heading', { name: 'Smoke signature detected', exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: 'Close observation details' })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Close observation details' })
      .waitFor({ state: 'detached' });
    assert.equal(
      await page
        .locator('.observation-row')
        .filter({ hasText: 'Smoke signature detected' })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      name + ' command overflow',
    );
    if (reducedMotion === 'no-preference')
      await page.screenshot({ path: `${root}/command-${width}.png` });
    await page.getByRole('button', { name: '06:00 IST', exact: true }).click();
    assert.equal(await page.locator('.observation-row').count(), 2);
    await page.goto('http://localhost:3001/command/sky', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Exploded view', exact: true }).waitFor();
    await page.locator('.drone-scene canvas').waitFor();
    await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
    await page.getByRole('button', { name: /Modular energy pack/ }).click();
    await page.waitForTimeout(1600);
    assert.equal(await page.locator('.drone-scene').getAttribute('data-selected-part'), 'battery');
    const bounds = await page.locator('.drone-scene').boundingBox();
    for (const id of ['battery', 'controller', 'camera']) {
      const el = page.locator(`.drone-scene [data-point=${id}]`);
      assert(await el.isVisible(), name + ' ' + id + ' visible');
      const box = await el.boundingBox();
      assert(
        box.x >= bounds.x - 2 &&
          box.y >= bounds.y - 2 &&
          box.x + box.width <= bounds.x + bounds.width + 2 &&
          box.y + box.height <= bounds.y + bounds.height + 2,
        name + ' ' + id + ' fits',
      );
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      name + ' sky overflow',
    );
    if (reducedMotion === 'no-preference')
      await page.locator('.engineering-stage').screenshot({ path: `${root}/sky-${width}.png` });
    await page.getByRole('button', { name: 'Reset engineering view' }).click();
    assert.equal(
      await page
        .getByRole('button', { name: 'Assembled', exact: true })
        .getAttribute('aria-pressed'),
      'true',
    );
    result.push({ name, motionSamples: proof.length, transformStates: changed, errors, failed });
    fs.writeFileSync(`${root}/matrix-results.json`, JSON.stringify(result, null, 2));
    console.log(
      name,
      JSON.stringify({ transformStates: changed, errors: errors.length, failed: failed.length }),
    );
    assert.deepEqual(errors, [], name + ' browser errors');
    assert.deepEqual(failed, [], name + ' network failures');
    await context.close();
  }
}
await browser.close();
