import { type Page, type Locator, type BrowserContext, expect } from "@playwright/test";

/**
 * Shared E2E helpers + the real test accounts.
 *
 * The app uses httpOnly cookie auth (credentials: "include"), so logging in
 * through the UI and reusing storageState is the reliable way to get an
 * authenticated session in tests. See auth.setup.ts / admin.setup.ts.
 */

// Test accounts. Credentials come from env (E2E_*); the literals below are the
// LOCAL dev-seed defaults only. NEVER point E2E at a shared/staging/prod DB with
// these defaults — set E2E_* to throwaway accounts and rotate the seeded
// passwords on any shared DB (see backend/database/seed.ts). isLocalE2E() in
// playwright.config.ts blocks remote runs unless ALLOW_REMOTE_E2E=1.
export const TEST_USER = {
  phone: process.env.E2E_USER_PHONE || "01712345678",
  password: process.env.E2E_USER_PASSWORD || "User@123",
  // This account is a 'vet' role user named "Rahim Ahmed" in the dev DB.
  name: process.env.E2E_USER_NAME || "Rahim Ahmed",
};

// Admin account (role 'admin', full access) — seeded in backend/database/seed.ts.
export const ADMIN_USER = {
  phone: process.env.E2E_ADMIN_PHONE || "01700000000",
  password: process.env.E2E_ADMIN_PASSWORD || "Admin@123",
  name: process.env.E2E_ADMIN_NAME || "Admin",
};

// Storage state files the setup projects write and authed specs reuse.
export const STORAGE_STATE = "tests/.auth/user.json";
export const ADMIN_STORAGE_STATE = "tests/.auth/admin.json";

// API base for cleanup-by-API (uses the session cookie from storageState).
// Mirrors PLAYWRIGHT_BASE_URL's API origin when running against a non-default host.
export const API_BASE = process.env.E2E_API_BASE || "http://localhost:5000/api/v1";

// Open the auth modal from the navbar and return the dialog locator.
export async function openAuthModal(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: /log\s?in/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

// Log in through the real modal with the given credentials. Used by the setup
// projects and login tests.
export async function loginViaUI(
  page: Page,
  creds: { phone: string; password: string } = TEST_USER
) {
  const dialog = await openAuthModal(page);
  await dialog.locator("#login-phone").fill(creds.phone);
  await dialog.locator("#login-password").fill(creds.password);
  await dialog.getByRole("button", { name: "Login", exact: true }).last().click();
  // Modal closes on success; the navbar swaps the Login button for the avatar.
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

// ── Browser-API mocks ──────────────────────────────────────────────────────
// Grant clipboard so ShareButton "copy link" flows can be asserted.
export async function grantClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://localhost:3000",
  });
}

// Inject a fake position so geolocation-driven flows (nearby vets, report-pet
// map "use my location") run without a real device prompt. Dhaka by default.
export async function mockGeolocation(
  context: BrowserContext,
  coords: { lat: number; lng: number } = { lat: 23.8103, lng: 90.4125 }
) {
  await context.grantPermissions(["geolocation"], {
    origin: "http://localhost:3000",
  });
  await context.setGeolocation({ latitude: coords.lat, longitude: coords.lng });
}

// ── Cleanup-by-API ─────────────────────────────────────────────────────────
// Build a Cookie header from a saved storageState file for direct API cleanup.
export function cookieHeaderFromState(statePath: string): string {
  // Lazy require so this stays usable in the browser-side test context too.
  const fs = require("fs");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  return (state.cookies || [])
    .map((c: any) => `${c.name}=${c.value}`)
    .join("; ");
}
