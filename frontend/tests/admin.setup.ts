import { test as setup, expect } from "@playwright/test";
import { loginViaUI, ADMIN_USER, ADMIN_STORAGE_STATE } from "./helpers";

/**
 * Admin auth setup — logs in as the seeded admin (01700000000) and saves the
 * session so admin-panel specs (tests/admin/) start authenticated as staff.
 */
setup("authenticate as admin", async ({ page }) => {
  await loginViaUI(page, ADMIN_USER);
  // Admin can reach /admin without being redirected home.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
