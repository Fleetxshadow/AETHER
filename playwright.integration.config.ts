import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testMatch: '**/integration.spec.ts',
  testIgnore: [],
  timeout: 120000,
  use: { ...base.use, baseURL: 'http://localhost:3003' },
  webServer: {
    command: 'npm.cmd run dev -- --hostname 127.0.0.1 --port 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      NEXUS_OPERATOR_PASSWORD: 'integration-local-only',
      NEXUS_CAMERA_ALLOWED_ORIGINS: 'http://127.0.0.1:8890',
      NEXUS_CAMERA_ALLOW_LOCAL_HTTP: 'true',
      NEXT_PUBLIC_NEXUS_FRESHNESS_MS: '2000',
    },
  },
});
