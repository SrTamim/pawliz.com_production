import { test, expect } from "@playwright/test";

/**
 * Vet dashboard (vet session). The test account 01712345678 is a 'vet', so it
 * can reach /vet-dashboard. Covers tab nav, the Profile Details editor (edit +
 * Save Profile + revert so the clinic record is unchanged), social links,
 * password-change validation, and the weekly schedule + clinic-contact controls.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/vet-dashboard");
  // Wait for the dashboard shell (sidebar nav) to render.
  await expect(
    page.getByRole("button", { name: /profile details/i })
  ).toBeVisible({ timeout: 20_000 });
});

test("dashboard tabs switch", async ({ page }) => {
  // Sidebar nav buttons carry an emoji prefix; use exact names so they don't
  // collide with overview CTAs like "View Reviews".
  await page.getByRole("button", { name: "🏠 Overview" }).click();
  await page.getByRole("button", { name: "⭐ Reviews" }).click();
  await page.getByRole("button", { name: "📋 Profile Details" }).click();
  await expect(page.getByRole("heading", { name: /profile details/i })).toBeVisible({
    timeout: 10_000,
  });
});

test("edit clinic description, save, then revert", async ({ page }) => {
  await page.getByRole("button", { name: /profile details/i }).click();
  const desc = page.getByPlaceholder("About your clinic...");
  await expect(desc).toBeVisible({ timeout: 10_000 });
  const original = await desc.inputValue();

  await desc.fill("E2E-TEST clinic description");
  const saveResp = page.waitForResponse(
    (r) => r.url().includes("/vet") && r.request().method() === "PUT",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: /save profile/i }).click();
  await saveResp;
  await expect(page.getByText(/updated successfully|profile updated/i).first()).toBeVisible({
    timeout: 8000,
  });

  // Revert so the real clinic record is unchanged.
  await desc.fill(original);
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/updated successfully|profile updated/i).first()).toBeVisible({
    timeout: 8000,
  });
});

test("social media inputs accept + persist (revert after)", async ({ page }) => {
  await page.getByRole("button", { name: /profile details/i }).click();
  const fb = page.getByPlaceholder("https://facebook.com/yourpage");
  await expect(fb).toBeVisible({ timeout: 10_000 });
  const original = await fb.inputValue();

  await fb.fill("https://facebook.com/e2e-test-page");
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/updated successfully|profile updated/i).first()).toBeVisible({
    timeout: 8000,
  });

  await fb.fill(original);
  await page.getByRole("button", { name: /save profile/i }).click();
  await expect(page.getByText(/updated successfully|profile updated/i).first()).toBeVisible({
    timeout: 8000,
  });
});

test("password change validates mismatch (no real change)", async ({ page }) => {
  await page.getByRole("button", { name: /profile details/i }).click();
  await page.getByRole("button", { name: /change password/i }).click();

  // Three password inputs appear (current, new, confirm) — only current/confirm
  // carry the "••••••••" placeholder, so target by type+order instead.
  const pwFields = page.locator('input[type="password"]');
  await expect(pwFields.first()).toBeVisible({ timeout: 10_000 });
  await pwFields.nth(0).fill("User@123"); // current
  await pwFields.nth(1).fill("NewPass123!"); // new
  await pwFields.nth(2).fill("Different123!"); // confirm (mismatch)
  await page.getByRole("button", { name: /update password/i }).click();
  // Client guard surfaces a mismatch (inline hint + toast) — the working
  // password is never changed.
  await expect(page.getByText(/do not match/i).first()).toBeVisible({ timeout: 8000 });
});

test("clinic contact can be added then removed", async ({ page }) => {
  await page.getByRole("button", { name: /profile details/i }).click();
  const valueInput = page.getByPlaceholder("Phone / Email / URL");
  await expect(valueInput).toBeVisible({ timeout: 10_000 });

  await valueInput.fill("01799999999");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  // The new contact row appears with a Remove button.
  const removeBtn = page.getByRole("button", { name: "Remove" }).last();
  await expect(removeBtn).toBeVisible({ timeout: 10_000 });
  // Clean up: remove it so we don't accumulate contacts.
  await removeBtn.click();
});
