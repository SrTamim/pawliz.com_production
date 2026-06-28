import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Boots the Next.js dev server on :3000 and runs the
 * smoke specs in tests/. CI runs headless with retries; local runs reuse an
 * already-running server if present.
 */
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "on",
  },
  projects: [
    // Public (logged-out) specs — everything in tests/ except the authed dir.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /tests[\\/]auth[\\/]/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: /tests[\\/]auth[\\/]/,
    },
    // One-time login → saves storageState for the authed project.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // Logged-in specs live in tests/auth/ and reuse the saved session.
    {
      name: "chromium-auth",
      testMatch: /tests[\\/]auth[\\/].*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  // Don't manage the server when pointing at an external base URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});