import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { installGoogleMapsDouble } from './map-setup';

const base = 'http://localhost:3003';
const sample = () => ({
  deviceId: 'pi-test',
  module: 'thermal',
  channel: 'temperature',
  value: 36.7,
  unit: '°C',
  observedAt: new Date().toISOString(),
  source: 'LIVE',
});
async function feed(page: Page, detail: Record<string, unknown>) {
  await expect(page.locator('.data-source-panel')).toHaveAttribute('data-demo-status', 'ready');
  await page.evaluate(
    (detail) => window.dispatchEvent(new CustomEvent('nexus:fixture', { detail })),
    detail,
  );
}
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  await installGoogleMapsDouble(page);
  errors.length = 0;
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(() => expect(errors, 'No unhandled application errors').toEqual([]));

test('feed and workspace startup preserve saved preferences across reloads', async ({ page }) => {
  await page.goto('/command/settings');
  await expect(page.locator('.data-source-panel')).toHaveAttribute('data-demo-status', 'ready');
  await page.getByRole('button', { name: /Simplified Accessible plan/ }).click();
  await page.getByRole('checkbox', { name: 'Enable optional audio' }).check();
  await page.reload();
  await expect(page.locator('.data-source-panel')).toHaveAttribute('data-demo-status', 'ready');
  await expect(page.getByRole('checkbox', { name: 'Enable optional audio' })).toBeChecked();
  await expect(page.getByRole('button', { name: /Simplified Accessible plan/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/command/twin');
  await page.reload();
  await expect(page.locator('.command-twin .aether-operational-map')).toHaveAttribute(
    'data-map-state',
    /missing|ready/,
  );
  await expect(page.locator('.command-twin canvas')).toHaveCount(0);
  await page.goto('/command/settings');
  await expect(page.locator('.data-source-panel')).toHaveAttribute('data-demo-status', 'ready');
  await expect(page.getByRole('checkbox', { name: 'Enable optional audio' })).toBeChecked();
});

test('empty, fresh, invalid, stale and failed feeds keep a functional labeled interface', async ({
  page,
}) => {
  await page.goto('/command');
  await expect(page.locator('.observation-row')).toHaveCount(8);
  await expect(page.locator('.data-source-panel')).toContainText('no Firebase configuration');
  await feed(page, { feed: 'telemetry', connection: 'connected', rows: [] });
  await expect(page.locator('.data-source-panel')).toContainText(
    'Connected — awaiting device data',
  );
  await feed(page, { feed: 'telemetry', connection: 'connected', rows: [sample()] });
  await expect(page.locator('.telemetry-instrument').nth(1)).toContainText('36.7');
  await expect(page.locator('.telemetry-instrument').nth(1)).toContainText('LIVE DATA');
  await page.getByRole('button', { name: 'Open theme configurator' }).click();
  await page.locator('.theme-preview').nth(1).click();
  await page.keyboard.press('Escape');
  await feed(page, {
    feed: 'telemetry',
    connection: 'connected',
    rows: [{ ...sample(), value: 37.2 }],
  });
  await expect(page.locator('.telemetry-instrument').nth(1)).toContainText('37.2');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'aqua');
  await feed(page, { feed: 'telemetry', connection: 'error' });
  await expect(page.locator('.data-source-panel')).toContainText('DEVICE OFFLINE');
  await expect(page.locator('.telemetry-instrument').nth(1)).toContainText('SIMULATED DEMO');
  await feed(page, {
    feed: 'telemetry',
    connection: 'connected',
    rows: [{ ...sample(), unit: 'invalid' }],
  });
  await page.locator('.data-source-panel summary').click();
  await expect(page.locator('.data-source-panel')).toContainText('invalid records ignored');
  await feed(page, { feed: 'telemetry', connection: 'connected', rows: [sample()] });
  await expect(page.locator('.data-source-panel')).toContainText('STALE READING', {
    timeout: 6000,
  });
  await expect(page.locator('.data-source-panel')).toContainText('UNAVAILABLE / STALE');
  await feed(page, { reset: true });
  await expect(page.locator('.data-source-panel')).toContainText('no Firebase configuration');
});

test('live observations stay current during demo replay and never receive synthetic evidence', async ({
  page,
}) => {
  await page.goto('/command');
  await expect(page.locator('.observation-row')).toHaveCount(8);
  const live = {
    id: 'live-thermal',
    siteId: 'main',
    deviceId: 'pi-test',
    module: 'thermal',
    title: 'Controlled device heat reading',
    district: 'Development location',
    location: [77.596, 12.976],
    position: [2, 2],
    severity: 'elevated',
    observedAt: new Date().toISOString(),
    resolvedAt: null,
    confidence: 91,
    description: 'Controlled test observation, not an incident.',
    source: 'Device observation',
    dataSource: 'LIVE',
    evidence: 'Metadata only',
    metric: 36.7,
    unit: '°C',
    sensor: 'Development sensor',
  };
  await feed(page, { feed: 'observations', connection: 'connected', rows: [live] });
  await page.evaluate((live) => {
    (window as unknown as { fixtureHeartbeat: number }).fixtureHeartbeat = window.setInterval(
      () =>
        window.dispatchEvent(
          new CustomEvent('nexus:fixture', {
            detail: {
              feed: 'observations',
              connection: 'connected',
              rows: [{ ...live, observedAt: new Date().toISOString() }],
            },
          }),
        ),
      500,
    );
  }, live);
  await page.getByRole('button', { name: '06:00 IST', exact: true }).click();
  await page.locator('.observation-row').filter({ hasText: live.title }).click();
  await expect(page.locator('.observation-detail')).toContainText(
    'LIVE · Device observation · pi-test',
  );
  await expect(page.locator('.observation-detail')).toContainText('No captured image supplied.');
  await expect(page.locator('.observation-detail').getByRole('img')).toHaveCount(0);
  await page.evaluate(() =>
    clearInterval((window as unknown as { fixtureHeartbeat: number }).fixtureHeartbeat),
  );
  await page.keyboard.press('Escape');
  await feed(page, { reset: true });
  await page.goto('/command/reports');
  await feed(page, {
    feed: 'observations',
    connection: 'connected',
    rows: [{ ...live, observedAt: new Date().toISOString() }],
  });
  const reportRow = page.locator('.report-table tbody tr').filter({ hasText: live.title });
  await expect(reportRow).toContainText('LIVE / pi-test');
  await expect(reportRow).not.toContainText('DEMO');
  await feed(page, { reset: true });
});

test('camera API enforces authorization, same origin, allowlists and credential redaction', async ({
  request,
}) => {
  const anonymous = await request.get('/api/response/cameras');
  expect(await anonymous.json()).toEqual({ authorized: false, canManage: false, cameras: [] });
  const headers = { Origin: base };
  const camera = {
    id: 'api-camera',
    deviceId: 'pi-api',
    name: 'API test',
    provider: 'mediamtx',
    url: 'http://127.0.0.1:8890/api-test/whep',
    development: true,
  };
  expect((await request.post('/api/response/cameras', { headers, data: camera })).status()).toBe(
    403,
  );
  await request.get('/api/response');
  expect(
    (
      await request.post('/api/response', {
        headers,
        data: { type: 'login', password: 'integration-local-only' },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await request.post('/api/response/cameras', {
        headers: { Origin: 'https://untrusted.test' },
        data: camera,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/response/cameras', {
        headers,
        data: { ...camera, url: 'http://untrusted.test/a/whep' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post('/api/response/cameras', {
        headers,
        data: { ...camera, provider: 'vdo-ninja', url: 'https://vdo.ninja/?push=publisher-secret' },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post('/api/response/cameras', { headers, data: camera })).ok(),
  ).toBeTruthy();
  const list = await (await request.get('/api/response/cameras')).json();
  expect(list.authorized).toBe(true);
  expect(JSON.stringify(list)).not.toContain('127.0.0.1:8890');
  expect(list.cameras.find((c: { id: string }) => c.id === 'api-camera').viewerUrl).toContain(
    '/api/response/cameras/api-camera/stream',
  );
  expect(
    (
      await request.post('/api/response/cameras/api-camera/stream', { headers, data: 'not SDP' })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        '/api/response/cameras/api-camera/stream?transport=hls&resource=https://evil.test/',
      )
    ).status(),
  ).toBe(404);
  await request.delete('/api/response/cameras', { headers });
  await request.post('/api/response', { headers, data: { type: 'logout' } });
  expect((await (await request.get('/api/response/cameras')).json()).authorized).toBe(false);
});

test('VDO iframe validates sender identity and handles provider disconnect', async ({ page }) => {
  await page.route('**/api/response/cameras', (route) =>
    route.fulfill({
      json: {
        authorized: true,
        canManage: false,
        cameras: [
          {
            id: 'vdo-test',
            deviceId: 'pi-test',
            name: 'VDO wiring test',
            provider: 'vdo-ninja',
            development: true,
            updatedAt: new Date().toISOString(),
            viewerUrl: 'https://vdo.ninja/?view=nexus-controlled-test',
          },
        ],
      },
    }),
  );
  await page.route('https://vdo.ninja/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body>Controlled provider fixture — no actual media</body></html>',
    }),
  );
  await page.goto('/command/sky');
  await page.getByRole('button', { name: 'Open camera', exact: true }).click();
  const iframe = page.frames().find((frame) => frame.url().startsWith('https://vdo.ninja/'));
  await expect
    .poll(() => page.frames().some((frame) => frame.url().startsWith('https://vdo.ninja/')))
    .toBe(true);
  await page.evaluate(() =>
    window.postMessage(
      { action: 'view-connection', streamID: 'nexus-controlled-test', value: true },
      location.origin,
    ),
  );
  await expect(page.locator('.camera-status')).toContainText('CONNECTING');
  const viewer =
    iframe || page.frames().find((frame) => frame.url().startsWith('https://vdo.ninja/'))!;
  await viewer.evaluate(
    (origin) =>
      parent.postMessage({ action: 'view-connection', streamID: 'wrong', value: true }, origin),
    base,
  );
  await expect(page.locator('.camera-status')).toContainText('CONNECTING');
  await viewer.evaluate(
    (origin) =>
      parent.postMessage(
        { action: 'view-connection', streamID: 'nexus-controlled-test', value: true },
        origin,
      ),
    base,
  );
  await expect(page.locator('.camera-status')).toContainText('connected viewer peer');
  await expect(page.locator('.camera-status')).toContainText(
    'Frame delivery is not independently measured',
  );
  await viewer.evaluate(
    (origin) =>
      parent.postMessage(
        { action: 'view-connection', streamID: 'nexus-controlled-test', value: false },
        origin,
      ),
    base,
  );
  await expect(page.locator('.camera-status')).toContainText('OFFLINE');
  await page.getByRole('button', { name: 'Close camera', exact: true }).click();
  await expect(page.locator('.camera-viewer iframe')).toHaveCount(0);
});

test('controlled synthetic WebRTC stream passes protected signaling, decodes and interrupts', async ({
  page,
}) => {
  let deleted = 0;
  await page.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    const peers: RTCPeerConnection[] = [];
    (window as unknown as { testPeers: RTCPeerConnection[] }).testPeers = peers;
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super(config);
        peers.push(this);
      }
    };
  });
  const server = createServer((request, response) => {
    void (async () => {
      if (request.method === 'DELETE') {
        deleted++;
        response.writeHead(204).end();
        return;
      }
      if (request.method !== 'POST') {
        response.writeHead(404).end();
        return;
      }
      let sdp = '';
      for await (const chunk of request) sdp += chunk.toString();
      const answer = await page.evaluate(async (sdp) => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const context = canvas.getContext('2d')!;
        let count = 0;
        const draw = () => {
          context.fillStyle = '#102b2b';
          context.fillRect(0, 0, 320, 180);
          context.fillStyle = '#ffb347';
          context.fillRect(count++ % 260, 60, 60, 60);
          context.fillStyle = 'white';
          context.font = '14px monospace';
          context.fillText('SYNTHETIC DEVELOPMENT STREAM', 15, 25);
        };
        draw();
        const timer = setInterval(draw, 66);
        const stream = canvas.captureStream(15),
          peer = new RTCPeerConnection();
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        await peer.setRemoteDescription({ type: 'offer', sdp });
        await peer.setLocalDescription(await peer.createAnswer());
        await new Promise<void>((resolve) => {
          if (peer.iceGatheringState === 'complete') return resolve();
          const timeout = setTimeout(resolve, 3000);
          peer.onicegatheringstatechange = () => {
            if (peer.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              resolve();
            }
          };
        });
        (window as unknown as { stopPublisher: () => void }).stopPublisher = () => {
          clearInterval(timer);
          stream.getTracks().forEach((track) => track.stop());
          peer.close();
        };
        return peer.localDescription!.sdp;
      }, sdp);
      response
        .writeHead(201, {
          'Content-Type': 'application/sdp',
          Location: '/development/whep/controlled-session',
        })
        .end(answer);
    })().catch(() => response.writeHead(500).end('Controlled publisher unavailable'));
  });
  await new Promise<void>((resolve) => server.listen(8890, '127.0.0.1', resolve));
  try {
    await page.request.get('/api/response');
    expect(
      (
        await page.request.post('/api/response', {
          headers: { Origin: base },
          data: { type: 'login', password: 'integration-local-only' },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await page.request.post('/api/response/cameras', {
          headers: { Origin: base },
          data: {
            id: 'webrtc-test',
            deviceId: 'development-publisher',
            name: 'SYNTHETIC DEVELOPMENT STREAM',
            provider: 'mediamtx',
            development: true,
            url: 'http://127.0.0.1:8890/development/whep',
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/command/sky');
    await page.getByLabel('Camera selector').selectOption('webrtc-test');
    await page.getByRole('button', { name: 'Open camera', exact: true }).click();
    try {
      await expect(page.locator('.camera-status')).toContainText('Decoded video frames received', {
        timeout: 20000,
      });
    } catch (error) {
      const diagnostic = await page.evaluate(async () => {
        const video = document.querySelector('video');
        const peers = (window as unknown as { testPeers: RTCPeerConnection[] }).testPeers;
        return {
          video: video
            ? { paused: video.paused, readyState: video.readyState, width: video.videoWidth }
            : null,
          peers: await Promise.all(
            peers.map(async (p) => ({
              connection: p.connectionState,
              ice: p.iceConnectionState,
              stats: [...(await p.getStats()).values()]
                .filter((s) => ['inbound-rtp', 'outbound-rtp'].includes(s.type))
                .map((s) => ({
                  type: s.type,
                  kind: s.kind,
                  bytesSent: s.bytesSent,
                  framesEncoded: s.framesEncoded,
                  framesDecoded: s.framesDecoded,
                })),
            })),
          ),
        };
      });
      await test.info().attach('controlled-stream-diagnostic', {
        body: JSON.stringify(diagnostic, null, 2),
        contentType: 'application/json',
      });
      throw error;
    }
    expect(
      await page.locator('.camera-viewer video').evaluate((v: HTMLVideoElement) => v.videoWidth),
    ).toBe(320);
    await expect(page.locator('.camera-info')).toContainText('320x180 / decoded video');
    await page
      .locator('.camera-panel')
      .screenshot({ path: 'docs/integration/controlled-webrtc.png' });
    await page.evaluate(() => (window as unknown as { stopPublisher: () => void }).stopPublisher());
    await expect(page.locator('.camera-status')).toContainText('OFFLINE', { timeout: 20000 });
    await expect(page.locator('.camera-fallback')).toBeVisible();
    await page.getByRole('button', { name: 'Close camera', exact: true }).click();
    await expect.poll(() => deleted).toBeGreaterThan(0);
    await expect(page.locator('.camera-viewer video')).toHaveCount(0);
  } finally {
    await page
      .evaluate(() => (window as unknown as { stopPublisher?: () => void }).stopPublisher?.())
      .catch(() => {});
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('camera fallback remains keyboard accessible at all requested viewports', async ({ page }) => {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1280, 720],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/command/sky');
    await expect(page.getByRole('heading', { name: 'SKY camera viewer' })).toBeVisible();
    await page.getByRole('button', { name: 'Refresh camera registry' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Refresh camera registry' })).toBeFocused();
    const box = await page.getByRole('button', { name: 'Refresh camera registry' }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const scan = await new AxeBuilder({ page })
      .include('.camera-panel')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(scan.violations).toEqual([]);
  }
});
