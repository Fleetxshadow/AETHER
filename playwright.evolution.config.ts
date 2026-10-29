import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:3002', launchOptions: {} },
  webServer: undefined,
});
