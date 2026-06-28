import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * Interactive E2E — drives the real auth UI like a user and verifies BOTH the
 * client-side validation AND that the backend responds through the frontend.
 *
 * Requires the backend running on :5000 (npm run dev in backend/) AND the
 * frontend dev server (Playwright boots it automatically via playwright.config).
 *
 * These tests open the AuthModal, type into real inputs, click real buttons,
 * and assert on the visible error/success the app produces.
 *
 * Selector note: the navbar ALSO has Login/Register buttons, so every
 * interaction is scoped to the open dialog to avoid strict-mode ambiguity.
 */

// Open the auth modal from the navbar and return the dialog locator.
async function openAuthModal(page: Page): Promise<Locator> {
  await page.goto("/");
  // Navbar Login button — first() picks the navbar one, not a tab.
  await page.getByRole("button", { name: /log\s?in/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

// Switch the modal to the Register tab (tab button lives inside the dialog).
async function gotoRegister(dialog: Locator) {
  await dialog.getByRole("button", { name: "Register" }).click();
  // Wait for a register-only field to appear.
  await expect(dialog.locator('input[name="name"]')).toBeVisible();
}

// Fill the register form. Pass overrides to make a single field invalid.
async function fillRegister(
  dialog: Locator,
  o: Partial<{
    name: string;
    phone: string;
    email: string;
    address: string;
    password: string;
    confirm: string;
  }> = {}
) {
  await dialog.locator('input[name="name"]').fill(o.name ?? "E2E Tester");
  await dialog.locator('input[name="phone"]').fill(o.phone ?? "01711111111");
  await dialog.locator('input[name="email"]').fill(o.email ?? "e2e@test.local");
  await dialog.locator('input[name="address"]').fill(o.address ?? "Dhaka");
  await dialog.locator('input[name="new-password"]').fill(o.password ?? "Password1");
  await dialog.locator('input[name="confirm-password"]').fill(o.confirm ?? "Password1");
}

test.describe("Register form validation (client-side)", () => {
  test("empty submit shows 'all fields required'", async ({ page }) => {
    const dialog = await openAuthModal(page);
    await gotoRegister(dialog);
    await dialog.getByRole("button", { name: "Create Account" }).click();
    await expect(dialog.getByText("All fields are required")).toBeVisible();
  });

  test("bad phone format is rejected", async ({ page }) => {
    const dialog = await openAuthModal(page);
    await gotoRegister(dialog);
    await fillRegister(dialog, { phone: "12345" }); // invalid BD phone
    await dialog.getByRole("button", { name: "Create Account" }).click();
    await expect(
      dialog.getByText(/valid Bangladeshi phone number/i)
    ).toBeVisible();
  });

  test("weak password is rejected", async ({ page }) => {
    const dialog = await openAuthModal(page);
    await gotoRegister(dialog);
    // < 8 chars, no number -> fails the password pattern.
    await fillRegister(dialog, { password: "short", confirm: "short" });
    await dialog.getByRole("button", { name: "Create Account" }).click();
    await expect(
      dialog.getByText(/at least 8 characters with letters and numbers/i)
    ).toBeVisible();
  });

  test("mismatched passwords show real-time hint", async ({ page }) => {
    const dialog = await openAuthModal(page);
    await gotoRegister(dialog);
    await fillRegister(dialog, { password: "Password1", confirm: "Password2" });
    // Real-time mismatch hint appears as you type the confirm field.
    await expect(dialog.getByText("Passwords do not match")).toBeVisible();
  });
});

test.describe("Login flow (hits the real backend)", () => {
  test("wrong credentials surface the backend error", async ({ page }) => {
    const dialog = await openAuthModal(page);
    // Login tab is the default. Inputs have stable ids.
    await dialog.locator("#login-phone").fill("01700000000");
    await dialog.locator("#login-password").fill("WrongPass123");
    // The submit button is the only one with this exact accessible name inside
    // the dialog once we exclude the tab (tab has aria-pressed). Use the
    // accent submit button: scope to dialog + exact name "Login".
    await dialog
      .getByRole("button", { name: "Login", exact: true })
      .last() // tab is first, submit button is last
      .click();
    // Backend rejects -> AuthModal renders the thrown error in an Alert.
    await expect(
      dialog.getByText(/invalid|incorrect|not found|wrong/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("correct credentials log in, then logout works", async ({ page }) => {
    const dialog = await openAuthModal(page);
    await dialog.locator("#login-phone").fill("01712345678");
    await dialog.locator("#login-password").fill("User@123");
    await dialog.getByRole("button", { name: "Login", exact: true }).last().click();
    // Success closes the modal and the navbar Login button disappears.
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /^log\s?in$/i }).first()
    ).toHaveCount(0);

    // Open the avatar menu and log out. The avatar is the clickable header
    // element bearing the user's initial; the menu has a "Logout" row.
    await page.locator("header").getByText("R", { exact: false }).first().click();
    await page.getByText(/logout/i).click();
    // Logged out -> the navbar Login button returns.
    await expect(
      page.getByRole("button", { name: /log\s?in/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
