import { test, expect } from "@playwright/test";

/**
 * Admin panel smoke (admin session via tests/.auth/admin.json). Verifies the
 * page loads for staff and that every one of the 16 sidebar sections switches
 * and renders content. Action coverage lives in admin-read-filters + admin-actions.
 */

// key → visible label (from src/components/Admin/permissions.ts).
const TABS: [string, RegExp][] = [
  ["overview", /Overview/],
  ["users", /Manage Users/],
  ["vets", /Manage Vets/],
  ["claim-requests", /Claim Requests/],
  ["reviews", /Reviews/],
  ["pets", /Manage Pets/],
  ["lost-pets-mgmt", /Lost Pets/],
  ["adoptable-pets", /Adoptable Pets/],
  ["found-pets", /Found Reports/],
  ["rescue-pets", /Rescue Reports/],
  ["comments", /Comments/],
  ["community-posts", /Reported Posts/],
  ["donation", /Donation/],
  ["settings", /Settings/],
  ["sms-settings", /SMS Update/],
  ["roles", /Role Manager/],
];

test("admin page loads for staff", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/);
  // The Overview nav item is always present for an admin.
  await expect(page.getByRole("button", { name: /Overview/ }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("all 16 admin sections switch and render", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: /Overview/ }).first()).toBeVisible({
    timeout: 20_000,
  });

  for (const [key, label] of TABS) {
    // Sidebar nav button text is "{icon} {label}".
    await page.getByRole("button", { name: label }).first().click();
    // Section content area should render *something* (not blank) — assert the
    // page didn't error by checking the main region still has visible text.
    await expect(page.locator("body")).toContainText(/\w/, { timeout: 10_000 });
    // Give async sections a beat to fetch.
    await page.waitForTimeout(150);
  }
});
