import { test, expect } from "@playwright/test";

/**
 * Smoke tests — verify the core public shell renders without the backend.
 * These intentionally avoid authenticated flows (no live API in CI); they
 * assert the app boots, hydrates, and the static/SSR chrome is present.
 */

test("home page loads with title and logo", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Pawliz/i);
  await expect(page.getByRole("img", { name: "Pawliz" })).toBeVisible();
});

test("auth modal opens from the navbar", async ({ page }) => {
  await page.goto("/");
  // Desktop "Login" button; falls back to the register/login CTA on mobile.
  const loginBtn = page.getByRole("button", { name: /log\s?in/i }).first();
  await loginBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("static legal pages render", async ({ page }) => {
  for (const path of ["/about", "/privacy", "/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} should return 200`).toBe(200);
  }
});