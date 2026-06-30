import { test as setup, expect } from "@playwright/test";
import { loginViaUI, STORAGE_STATE } from "./helpers";

/**
 * Auth setup project — runs once before authed specs. Logs in via the real UI
 * and saves the cookie session to STORAGE_STATE so login-gated tests start
 * already authenticated (no per-test login cost, no flakiness).
 */
setup("authenticate", async ({ page }) => {
  await loginViaUI(page);
  // Sanity: the home page no longer shows a navbar Login button when authed.
  await expect(
    page.getByRole("button", { name: /^log\s?in$/i }).first()
  ).toHaveCount(0);
  await page.context().storageState({ path: STORAGE_STATE });
});
