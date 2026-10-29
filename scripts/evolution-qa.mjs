import { chromium, expect, request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { randomUUID, createHmac } from 'node:crypto';
const base = process.env.NEXUS_QA_URL || 'http://localhost:3002';
const env = fs.readFileSync('.env.local', 'utf8');
const password = env.match(/^NEXUS_OPERATOR_PASSWORD=(.+)$/m)[1].trim();
const secret = env.match(/^NEXUS_DEMO_WEBHOOK_SECRET=(.+)$/m)[1].trim();
const root = 'docs/evolution/verified';
fs.mkdirSync(root, { recursive: true });
const results = { api: [], views: [], voice: [], accessibility: [] };
const browser = await chromium.launch({ channel: 'chrome' });
const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
const other = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
const post = async (client, data, status = 200) => {
  const response = await client.post('/api/response', { data });
  expect(response.status()).toBe(status);
  return response.json();
};
try {
  await api.get('/api/response');
  await other.get('/api/response');
  const created = await post(api, {
    type: 'intake',
    input: { text: 'Fire, 2 people trapped. callback 9876543210', language: 'en-IN' },
  });
  const id = created.createdId;
  let version = 1;
  expect(created.incidents.find((i) => i.id === id).description).not.toContain('9876543210');
  expect((await (await other.get('/api/response')).json()).incidents).toEqual([]);
  await post(
    other,
    { type: 'review', input: { id, version, action: 'refer', note: 'urgent handoff' } },
    403,
  );
  await post(other, { type: 'delete', id, version }, 404);
  const csrf = await api.post('/api/response', {
    headers: { Origin: 'https://untrusted.invalid' },
    data: { type: 'logout' },
  });
  expect(csrf.status()).toBe(403);
  await post(
    api,
    { type: 'intake', input: { text: 'fire', language: 'en-IN', callback: '1234567890' } },
    400,
  );
  await post(api, { type: 'login', password: 'incorrect-test-password' }, 401);
  await post(api, { type: 'login', password });
  await post(
    api,
    { type: 'review', input: { id, version, action: 'verify', note: 'Invalid shortcut' } },
    400,
  );
  for (const action of [
    'assign',
    'triage',
    'review',
    'verify',
    'evidence-request',
    'evidence-pending',
    'evidence-available',
    'refer',
    'close',
  ]) {
    const data = await post(api, {
      type: 'review',
      input: { id, version, action, note: `Human demo ${action}` },
    });
    version++;
    const current = data.incidents.find((i) => i.id === id);
    expect(current.version).toBe(version);
    expect(current.externalContactConfirmed).toBe(false);
  }
  await post(
    api,
    { type: 'review', input: { id, version: 1, action: 'refer', note: 'Stale version' } },
    409,
  );
  await post(api, { type: 'delete', id, version });
  expect((await (await api.get('/api/response')).json()).incidents.some((i) => i.id === id)).toBe(
    false,
  );
  await post(api, { type: 'seed' });
  results.api.push(
    'Session isolation, server roles, invalid/stale workflow, consent, CSRF, deletion, human audit and simulated referral passed.',
  );
  const sessionId = randomUUID();
  const webhook = async (type, extra = {}, status = 200) => {
    const event = { eventId: randomUUID(), sessionId, type, ...extra };
    const raw = JSON.stringify(event),
      timestamp = String(Date.now());
    const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    const response = await api.post('/api/response/webhook', {
      data: raw,
      headers: {
        'Content-Type': 'application/json',
        'x-nexus-timestamp': timestamp,
        'x-nexus-signature': signature,
      },
    });
    expect(response.status()).toBe(status);
    return { event, raw, timestamp, signature, data: await response.json() };
  };
  const incoming = await webhook('incoming');
  expect(incoming.data.state).toBe('connected');
  const replay = await api.post('/api/response/webhook', {
    data: incoming.raw,
    headers: { 'x-nexus-timestamp': incoming.timestamp, 'x-nexus-signature': incoming.signature },
  });
  expect(replay.status()).toBe(409);
  await webhook('transcript', { text: 'आग लगी है, 2 लोग फँसे हैं' }, 400);
  await webhook('language', { language: 'hi-IN' });
  const transcription = await webhook('transcript', {
    text: 'आग लगी है, 2 लोग फँसे हैं',
    transcriptionConsent: true,
  });
  expect(transcription.data.incidentId).toBeTruthy();
  await webhook('handoff');
  await webhook('ended');
  await webhook('language', {}, 409);
  const forged = await api.post('/api/response/webhook', {
    data: '{}',
    headers: { 'x-nexus-timestamp': String(Date.now()), 'x-nexus-signature': '0'.repeat(64) },
  });
  expect(forged.status()).toBe(401);
  results.api.push(
    'Signed local-demo incoming/language/transcript/handoff/end lifecycle, invalid signature, replay and transcription-consent tests passed. No PSTN calls.',
  );
  const auth = (await api.storageState()).cookies;
  for (const theme of ['original', 'aqua', 'spectrum', 'sage']) {
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
    ]) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
        await context.addCookies(auth);
        await context.addCookies([{ name: 'nexus-theme', value: theme, url: base }]);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(m.text());
        });
        const name = `${theme}-${width}x${height}-${reducedMotion === 'reduce' ? 'reduced' : 'normal'}`;
        await page.goto(`${base}/command/response`);
        await expect(page.getByRole('heading', { name: 'Operator authenticated' })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await page.locator('a[href="tel:112"]').getAttribute('href')).toBe('tel:112'); // Never activate emergency link.
        await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
        await page
          .getByLabel('Caller statement / live transcript')
          .fill('आग लगी है, 2 लोग फँसे हैं।');
        await expect(page.locator('.response-extraction')).toContainText('URGENT FLAG');
        await page.locator('.response-queue-item').first().click();
        await page
          .getByRole('combobox', { name: /Overlay|Incident map overlay/ })
          .selectOption('traffic');
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo({ top: 0, behavior: 'instant' });
        });
        await page.screenshot({ path: `${root}/response-${name}.png`, fullPage: true });
        const geometry = await page.evaluate(() => {
          const pins = [...document.querySelectorAll('.response-pin')].map((e) =>
            e.getBoundingClientRect().toJSON(),
          );
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            overlap: pins.some((a, i) =>
              pins
                .slice(i + 1)
                .some(
                  (b) =>
                    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
                ),
            ),
            targets: pins.every((p) => p.width >= 44 && p.height >= 44),
          };
        });
        expect(geometry).toEqual({ overflow: false, overlap: false, targets: true });
        if (width === 1440 && reducedMotion === 'no-preference') {
          const audit = await new AxeBuilder({ page }).analyze();
          results.accessibility.push({ theme, page: 'response', violations: audit.violations });
        }
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        if (reducedMotion === 'no-preference') {
          await page.goto(`${base}/`);
          await page.locator('.cinematic-hero canvas').waitFor();
          await expect(page.locator('.rebirth')).toHaveAttribute('data-entrance', 'complete');
          await page.screenshot({ path: `${root}/hero-${name}.png` });
          const spacing = await page.evaluate(() => {
            const get = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
            return {
              copy: get('.cinema-copy'),
              dock: get('.observatory-dock'),
              footer: get('.cinema-footer'),
              overflow: document.documentElement.scrollWidth > innerWidth,
            };
          });
          expect(spacing.overflow).toBe(false);
          expect(spacing.dock.bottom).toBeLessThanOrEqual(spacing.footer.top);
          if (width === 768) expect(spacing.copy.bottom).toBeLessThanOrEqual(spacing.dock.top);
          await page.goto(`${base}/command`);
          await page.locator('.map-record-marker').first().waitFor();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${root}/command-${name}.png` });
          await page.goto(`${base}/command/sky`);
          await page.locator('.drone-scene canvas').waitFor();
          await page.getByRole('button', { name: 'Exploded view', exact: true }).click();
          await page.waitForTimeout(700);
          await page
            .locator('.engineering-explorer')
            .screenshot({ path: `${root}/sky-${name}.png` });
        }
        expect(errors).toEqual([]);
        results.views.push({ name, ...geometry, errors });
        console.log(`${name}: passed`);
        await context.close();
      }
    }
  }
  // Deterministic browser API fixtures verify event wiring, consent, language interruption and failures.
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    window.__voiceFixture = [];
    class Recognition {
      start() {
        window.__recognition = this;
        window.__voiceFixture.push({ event: 'start', lang: this.lang });
        this.onstart?.();
        this.onspeechstart?.();
      }
      abort() {
        window.__voiceFixture.push({ event: 'abort' });
        this.onend?.();
      }
    }
    window.SpeechRecognition = Recognition;
  });
  const page = await context.newPage();
  await page.goto(`${base}/command/response`);
  const microphone = page.getByRole('button', { name: 'Start microphone' });
  await expect(microphone).toBeDisabled();
  await page.getByLabel(/I consent to browser microphone transcription/).check();
  await microphone.click();
  await expect(page.locator('.response-state')).toHaveText('listening');
  const animation = await page
    .locator('.voice-wave i')
    .first()
    .evaluate((e) => getComputedStyle(e).animationName);
  expect(animation).toBe('response-wave');
  await page.evaluate(() =>
    window.__recognition.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'Fire near school, 2 people trapped' } }],
    }),
  );
  await expect(page.getByLabel('Caller statement / live transcript')).toContainText(
    'Fire near school',
  );
  await page.getByRole('button', { name: 'हिन्दी', exact: true }).click();
  expect((await page.evaluate(() => window.__voiceFixture)).some((e) => e.event === 'abort')).toBe(
    true,
  );
  await microphone.click();
  expect(await page.evaluate(() => window.__recognition.lang)).toBe('hi-IN');
  await page.evaluate(() => window.__recognition.onerror({ error: 'not-allowed' }));
  await expect(
    page.getByRole('alert').filter({ hasText: 'Transcription not-allowed' }),
  ).toBeVisible();
  await page.getByLabel('Caller statement / live transcript').fill('बेहोश व्यक्ति, 2 लोग प्रभावित');
  await page.getByRole('button', { name: 'Submit demo report' }).click();
  await expect(page.locator('.response-detail')).toContainText('MEDICAL');
  await page.getByRole('button', { name: 'Simulate incoming call' }).click();
  await page.getByRole('button', { name: 'Accept demo' }).click();
  await page
    .getByLabel('Caller statement / live transcript')
    .fill('paani bhar gaya, 3 log affected');
  await page.getByRole('button', { name: 'Submit demo report' }).click();
  await expect(page.locator('.response-state')).toHaveText('human handoff');
  await page.getByRole('button', { name: 'End demo call' }).click();
  await expect(page.locator('.response-state')).toHaveText('ended');
  results.voice.push(
    'API-event fixtures: consent gating, listening/speech waveform, final transcript, Hindi switch/abort, denial fallback, structured Hindi report, simulated incoming/accept/report/handoff/end passed. Not an acoustic recognition test.',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await microphone.click();
  expect(
    await page
      .locator('.voice-wave i')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
  results.voice.push('Reduced-motion waveform disabled while controls remain usable.');
  await context.close();
  console.log('Evolution browser/API matrix finished.');
} finally {
  fs.writeFileSync(`${root}/results.json`, JSON.stringify(results, null, 2));
  await api.dispose();
  await other.dispose();
  await browser.close();
}
