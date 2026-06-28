import { test, expect } from "@playwright/test";

/**
 * Help Board — lost / found / rescue / adoption tabs, search, and filters.
 * Logged-out: the report CTAs prompt login (covered). Actual create flows
 * (found/rescue) require auth and live in tests/auth/profile-flows where the
 * session exists — here we verify navigation, tab switching, search, filters,
 * and that report buttons gate on auth.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/help-board");
  // Page heading renders once the tab initializes.
  await expect(page.getByRole("tablist")).toBeVisible();
});

test("all four tabs are present and switchable", async ({ page }) => {
  for (const name of ["Lost", "Found", "Rescue", "Adopt"]) {
    const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }
});

test("search box filters posts", async ({ page }) => {
  const search = page.getByPlaceholder(/search/i).first();
  await expect(search).toBeVisible();
  await search.fill("zzznotarealpet");
  // Filtering is client-side and instant; an unmatched query empties the grid.
  await expect(page.getByText(/^Showing 0/i)).toBeVisible({ timeout: 5000 });
});

test("pet type and location filters work", async ({ page }) => {
  const petType = page.getByLabel(/pet type/i);
  await petType.selectOption("dog");
  await expect(petType).toHaveValue("dog");

  const location = page.getByLabel(/location/i);
  await location.selectOption("Dhaka");
  await expect(location).toHaveValue("Dhaka");
});

test("report (found) button prompts login when logged out", async ({ page }) => {
  await page.getByRole("tab", { name: /found/i }).click();
  // The warm CTA in the controls row triggers the report-found action.
  await page.getByRole("button", { name: /report/i }).first().click();
  // Logged out -> auth modal opens.
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("report (rescue) button prompts login when logged out", async ({ page }) => {
  await page.getByRole("tab", { name: /rescue/i }).click();
  await page.getByRole("button", { name: /report|rescue/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
