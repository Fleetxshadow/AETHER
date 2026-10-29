import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/integration.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3001',
    channel: 'chrome',
    trace: 'retain-on-failure',
    // Suites run as returning visitors; tests/intro.spec.ts opts back into the first-visit film.
    storageState: {
      cookies: [],
      origins: ['http://127.0.0.1:3001', 'http://localhost:3002', 'http://localhost:3003'].map(
        (origin) => ({ origin, localStorage: [{ name: 'aether-intro-v1', value: 'seen' }] }),
      ),
    },
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader-webgl'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'npm.cmd run start -- --port 3001',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
