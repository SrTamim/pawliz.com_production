import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Boots the Next.js dev server on :3000 and runs the
 * smoke specs in tests/. CI runs headless with retries; local runs reuse an
 * already-running server if present.
 */
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

// Safety guard: these specs perform real mutations (deletes, password forms) and
// the admin spec logs in with seeded admin credentials. Running them against a
// shared/staging/prod host could destroy data or expose those creds. Refuse any
// non-local base URL unless the operator explicitly opts in with ALLOW_REMOTE_E2E=1.
(() => {
  let host = "";
  try {
    host = new URL(BASE_URL).hostname;
  } catch {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL: ${BASE_URL}`);
  }
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
  if (!isLocal && process.env.ALLOW_REMOTE_E2E !== "1") {
    throw new Error(
      `Refusing to run E2E against non-local host "${host}". These tests mutate data and use seeded admin credentials. ` +
        `Set ALLOW_REMOTE_E2E=1 to override, and ensure E2E_* credentials point at throwaway accounts.`,
    );
  }
})();

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
    // Public (logged-out) specs — everything in tests/ except the authed and
    // admin dirs (those need a session).
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /tests[\\/](auth|admin)[\\/]/,
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: /tests[\\/](auth|admin)[\\/]/,
    },
    // One-time vet login → saves storageState for the authed project.
    { name: "setup", testMatch: /[\\/]auth\.setup\.ts/ },
    // Logged-in (vet) specs live in tests/auth/ and reuse the saved session.
    {
      name: "chromium-auth",
      testMatch: /tests[\\/]auth[\\/].*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    // One-time admin login → saves the admin storageState.
    { name: "admin-setup", testMatch: /admin\.setup\.ts/ },
    // Admin-panel specs live in tests/admin/ and reuse the admin session.
    {
      name: "chromium-admin",
      testMatch: /tests[\\/]admin[\\/].*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/admin.json",
      },
      dependencies: ["admin-setup"],
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