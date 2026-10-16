import { defineConfig, devices } from '@playwright/test';

/**
 * The order flow on emulated phones: the built /megrendeles, as guests get it, with the API stubbed
 * in the browser (e2e/api.ts). Separate from `pnpm test`: run it with `pnpm --filter @piccolo/web
 * e2e`.
 */
// Off the ports `pnpm dev` uses, so the suite runs beside it.
const webPort = 4322;
const apiPort = 8790;

export default defineConfig({
  testDir: 'e2e',
  // `*.e2e.ts`, never `*.spec.ts` or `*.test.ts`, so Vitest does not collect these files.
  testMatch: '**/*.e2e.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    locale: 'hu-HU',
    timezoneId: 'Europe/Budapest',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node e2e/config-api.ts',
      url: `http://localhost:${apiPort}/api/config/public`,
      env: { PORT: String(apiPort) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // The build fetches the public config from the server above and bakes it into the page.
      command: `astro build && astro preview --port ${webPort}`,
      url: `http://localhost:${webPort}/megrendeles`,
      // The browser never reaches this origin: e2e/api.ts answers every request to it.
      env: {
        PUBLIC_API_URL: `http://localhost:${apiPort}`,
        PUBLIC_IMAGES_URL: `http://localhost:${apiPort}`,
        // Astro detaches `astro preview` when it detects a coding agent, and Playwright then sees
        // the process exit. Set, the variable skips that detection and the server stays attached.
        ASTRO_PREVIEW_BACKGROUND: '1',
      },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
