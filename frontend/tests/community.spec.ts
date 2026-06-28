import { test, expect } from "@playwright/test";

/**
 * Community page — feed, tag filters, and the compose CTA (which gates on auth
 * when logged out). Posting a real status is covered in the authed suite.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/community");
});

test("page renders heading and compose pill", async ({ page }) => {
  await expect(page).toHaveTitle(/Community/i);
  await expect(page.locator(".compose-pill")).toBeVisible();
});

test("tag filter pills are present and clickable", async ({ page }) => {
  const tablist = page.getByRole("tablist");
  await expect(tablist).toBeVisible();
  // The "All" tab always exists; it should start selected.
  const allTab = page.getByRole("tab").first();
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  // If category tags loaded, clicking one selects it.
  const tabs = page.getByRole("tab");
  if ((await tabs.count()) > 1) {
    const second = tabs.nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-selected", "true");
  }
});

test("compose pill prompts login when logged out", async ({ page }) => {
  await page.locator(".compose-pill").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
