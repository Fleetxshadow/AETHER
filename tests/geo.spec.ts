import { test, expect } from '@playwright/test';
import { installGoogleMapsDouble } from './map-setup';
import type { TrafficView } from '../src/lib/traffic/client';

test('GEO reuses private FLOW geometry, incident IDs and CORE findings without verification writes', async ({
  page,
}) => {
  await installGoogleMapsDouble(page);
  await page.goto('/traffic');
  let state: TrafficView | null = null;
  for (const label of ['Start private demo', 'Generate sustained slowdown', 'Run CORE analysis']) {
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/response/traffic') && r.request().method() === 'POST',
      ),
      page.getByRole('button', { name: label, exact: true }).click(),
    ]);
    expect(response.ok()).toBe(true);
    state = (await response.json()).state;
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  }
  const incident = state!.incidents.find((i) => i.status === 'ACTIVE')!;
  const road = state!.segments.find((r) => incident.segmentIds.includes(r.id))!;
  const analysis = state!.investigations.find((i) => i.incidentId === incident.id)!;
  expect(analysis).toBeTruthy();
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') writes.push(new URL(r.url()).pathname);
  });
  await page.goto('/command/geo');
  await page.getByRole('button', { name: 'Explore labeled DEMO scenario', exact: true }).click();
  await page.locator('.geo-import summary').click();
  await expect(
    page.getByRole('button', { name: 'Read authorized FLOW', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Read private DEMO FLOW', exact: true }).click();
  await page
    .locator('.geo-record-row')
    .filter({ hasText: road.roadName + ' / ' + road.direction })
    .click();
  const detail = page.locator('.geo-record-detail');
  await expect(detail).toHaveAttribute('data-feature-id', road.id);
  await expect(detail.locator('.geo-provenance')).toHaveText('SIMULATED / DEMO');
  await expect(detail.locator('dl')).toContainText(incident.id);
  await expect(detail).toContainText(analysis.uncertainty);
  await expect(detail).toContainText('No verified cause supplied.');
  await expect(detail).toContainText(road.estimate.level);
  await detail.locator('.geo-evidence summary').click();
  await expect(detail.locator('.geo-evidence')).toContainText(road.geometryProvenance);
  await expect(detail.locator('.geo-evidence')).toContainText(incident.id);
  expect(writes).toEqual([]);
});
