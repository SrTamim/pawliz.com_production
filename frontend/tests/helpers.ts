import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Shared E2E helpers + the real test account.
 *
 * The app uses httpOnly cookie auth (credentials: "include"), so logging in
 * through the UI and reusing storageState is the reliable way to get an
 * authenticated session in tests. See auth.setup.ts.
 */

export const TEST_USER = {
  phone: "01712345678",
  password: "User@123",
  // This account is a 'vet' role user named "Rahim Ahmed" in the dev DB.
  name: "Rahim Ahmed",
};

// Storage state file the auth.setup.ts project writes and authed specs reuse.
export const STORAGE_STATE = "tests/.auth/user.json";

// Open the auth modal from the navbar and return the dialog locator.
export async function openAuthModal(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.getByRole("button", { name: /log\s?in/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

// Log in through the real modal. Used by auth.setup.ts and login tests.
export async function loginViaUI(page: Page) {
  const dialog = await openAuthModal(page);
  await dialog.locator("#login-phone").fill(TEST_USER.phone);
  await dialog.locator("#login-password").fill(TEST_USER.password);
  await dialog.getByRole("button", { name: "Login", exact: true }).last().click();
  // Modal closes on success; the navbar swaps the Login button for the avatar.
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
