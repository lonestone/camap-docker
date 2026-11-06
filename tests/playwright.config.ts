import { defineConfig, devices } from '@playwright/test';
import { env } from './src/env.js';

/**
 * One shared DB and one shared (fake) clock: tests must run one at a time.
 * Projects:
 *   unit  pure unit tests of the harness (src/**\/*.test.ts), no stack needed
 *   hx|ts characterisation specs (specs/**\/*.spec.ts) against TARGET
 */
export default defineConfig({
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // amd64 images run under emulation on Apple silicon: be generous
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: env.baseUrl,
    locale: 'fr-FR',
    timezoneId: env.appTimeZone,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: 'unit',
      testDir: 'src',
      testMatch: /.*\.test\.ts$/,
    },
    {
      name: env.target,
      testDir: 'specs',
      testMatch: /.*\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: env.baseUrl, locale: 'fr-FR', timezoneId: env.appTimeZone },
    },
  ],
});
