import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
const fixture = readFile('tests/fixtures/google-maps-api.js', 'utf8');
// Deterministic regression checks; real Google geography is checked separately.
export async function installGoogleMapsDouble(page: Page) {
  await page.route('https://maps.googleapis.com/maps/api/js?**', async (route) =>
    route.fulfill({ contentType: 'application/javascript', body: await fixture }),
  );
}
