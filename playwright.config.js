import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Playwright's default testMatch globs **/*.test.* as well as **/*.spec.*, which would
  // pick up the plain-Node suites in tests/ (auth-posture.test.mjs), import them, and run
  // their top-level code — including process.exit(), which silently truncates the smoke
  // run. Restrict Playwright to .spec.js so the two kinds of test cannot collide.
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'never' }], ['line']],
  use: {
    headless: true,
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use an already-installed Chrome/Chromium when one is pointed at, so the suite
        // runs in sandboxes and images that ship a browser but cannot download
        // Playwright's pinned build. CI leaves these unset and uses the pinned browser
        // installed by `npx playwright install --with-deps chromium`.
        launchOptions: {
          ...(process.env.DGO_CHROME_PATH ||
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
          process.env.CHROME_PATH
            ? {
                executablePath:
                  process.env.DGO_CHROME_PATH ||
                  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                  process.env.CHROME_PATH,
              }
            : {}),
          ...(process.env.DGO_CHROME_NO_SANDBOX ? { args: ['--no-sandbox'] } : {}),
        },
      },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
