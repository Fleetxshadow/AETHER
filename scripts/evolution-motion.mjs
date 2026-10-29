import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const base = process.env.NEXUS_QA_URL || 'http://localhost:3002';
const root = 'docs/evolution/motion';
fs.mkdirSync(root, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
  recordVideo: { dir: root, size: { width: 1440, height: 900 } },
});
await context.addInitScript(() => {
  window.__speechEvents = [];
  if (window.speechSynthesis) {
    const speak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => {
      for (const name of ['start', 'end', 'error'])
        u.addEventListener(name, (e) =>
          window.__speechEvents.push({ event: name, error: e.error || null }),
        );
      speak(u);
    };
  }
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const evidence = {};
try {
  await page.goto(base);
  await page.locator('.cinematic-hero canvas').waitFor();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'playing');
  await page.waitForTimeout(800);
  evidence.heroAnimations = await page.evaluate(
    () => document.getAnimations().filter((a) => a.playState === 'running').length,
  );
  expect(evidence.heroAnimations).toBeGreaterThan(0);
  await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
  await page.getByRole('button', { name: 'Open theme configurator' }).click();
  await page.getByRole('button', { name: /Aqua Future/ }).click();
  await page.waitForTimeout(700);
  await page.keyboard.press('Escape');
  await page.locator('.response-home-preview').scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: 'Explore AETHER RESPONSE' }).click();
  await expect(page.locator('.route-transition')).toHaveAttribute('data-transition', 'idle');
  await page.getByRole('button', { name: 'Simulate incoming call' }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Accept demo' }).click();
  await page
    .getByLabel('Caller statement / live transcript')
    .fill('Fire near East interchange, 2 people trapped.');
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Submit demo report' }).click();
  await expect(page.locator('.response-detail')).toBeVisible();
  await page.locator('.response-detail').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Read welcome aloud' }).click();
  await page.waitForTimeout(7500);
  evidence.nativeSpeech = await page.evaluate(() => ({
    events: window.__speechEvents,
    recognitionAPI: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    voices:
      window.speechSynthesis
        ?.getVoices()
        .map((v) => ({ lang: v.lang, localService: v.localService })) || [],
    state: document.querySelector('.response-state')?.textContent,
  }));
  await page.getByRole('button', { name: 'Stop voice', exact: true }).click();
  await page.getByRole('button', { name: 'End demo call' }).click();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.screenshot({ path: `${root}/response-viewport.png` });
  evidence.errors = errors;
  expect(errors).toEqual([]);
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${root}/evolution-walkthrough.webm`);
  fs.writeFileSync(`${root}/results.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
console.log(
  'Motion walkthrough captured; native speech capability evidence saved. No microphone activated or phone call made.',
);
