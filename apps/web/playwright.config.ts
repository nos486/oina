import { defineConfig, devices } from '@playwright/test';

// The API is mocked in the tests (see e2e/fixtures.ts), so only the web dev server runs.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 390, height: 844 },
    locale: 'fa-IR',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'mobile-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } }],
  webServer: {
    command: 'pnpm exec vite --port 5174 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
});
