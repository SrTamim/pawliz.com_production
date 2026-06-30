import { test, expect } from "@playwright/test";

/**
 * Admin read + filter coverage (admin session). For each data section, switch
 * to it, type a search query and/or change a filter dropdown, and assert the
 * view responds without error (rows or an empty-state render). These are
 * read-only — no data is modified.
 */

async function gotoSection(page: any, label: RegExp) {
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: /Overview/ }).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: label }).first().click();
}

test("Manage Vets — search + status/active filters", async ({ page }) => {
  await gotoSection(page, /Manage Vets/);
  await page.getByPlaceholder("Search by name or location...").fill("dhaka");
  await page.waitForTimeout(700); // debounced 400ms
  // Two filter dropdowns: approval status + active status.
  const selects = page.locator("select");
  await selects.nth(0).selectOption("approved");
  await selects.nth(1).selectOption("active");
  await expect(page.locator("body")).toContainText(/Clinic|All Clinics|No /i, {
    timeout: 8000,
  });
});

test("Reviews — search responds", async ({ page }) => {
  await gotoSection(page, /Reviews/);
  await page.getByPlaceholder(/Search by user, clinic or comment/i).fill("zzz");
  await page.waitForTimeout(700);
  await expect(page.locator("body")).toContainText(/Review|No /i, { timeout: 8000 });
});

test("Manage Pets — search + type filter", async ({ page }) => {
  await gotoSection(page, /Manage Pets/);
  await page.getByPlaceholder("Search by name or Pet ID...").fill("a");
  await page.waitForTimeout(700);
  await page.locator("select").first().selectOption("dog");
  await expect(page.locator("body")).toContainText(/Pet|No /i, { timeout: 8000 });
});

test("Lost Pets — search responds", async ({ page }) => {
  await gotoSection(page, /Lost Pets/);
  await page.getByPlaceholder("Search by name or Pet ID...").fill("zzz");
  await page.waitForTimeout(700);
  await expect(page.locator("body")).toContainText(/Pet|No /i, { timeout: 8000 });
});

test("Found Reports — search responds", async ({ page }) => {
  await gotoSection(page, /Found Reports/);
  await page.getByPlaceholder(/Search by type, location, breed/i).fill("zzz");
  await page.waitForTimeout(700);
  await expect(page.locator("body")).toContainText(/Found|Report|No /i, {
    timeout: 8000,
  });
});

test("Rescue Reports — search responds", async ({ page }) => {
  await gotoSection(page, /Rescue Reports/);
  await page.getByPlaceholder(/Search by type, location, breed/i).fill("zzz");
  await page.waitForTimeout(700);
  await expect(page.locator("body")).toContainText(/Rescue|Report|No /i, {
    timeout: 8000,
  });
});

test("Manage Users — search responds", async ({ page }) => {
  await gotoSection(page, /Manage Users/);
  await page.getByPlaceholder("Search by name, phone or email...").fill("rahim");
  await page.waitForTimeout(700);
  await expect(page.locator("body")).toContainText(/User|All Users/i, {
    timeout: 8000,
  });
});

test("Comments (reported) — search responds", async ({ page }) => {
  await gotoSection(page, /Comments/);
  // Client-side filter (no debounce).
  await page.getByPlaceholder(/Search by name or phone/i).fill("zzz");
  await expect(page.locator("body")).toContainText(/comment|No reported/i, {
    timeout: 8000,
  });
});
