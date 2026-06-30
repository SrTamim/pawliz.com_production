import { test, expect } from "@playwright/test";

/**
 * Public vet detail page (/vets/[id]). Uses a real vet id from the dev DB.
 * The page SSRs the vet name into <title> and renders the VetDetailPage shell
 * client-side. We assert the page resolves a real vet (not the fallback title).
 */

// A real, approved vet id present in the dev DB (see /v1/vets/map).
const VET_ID = 14;

test("vet detail page loads a real vet", async ({ page }) => {
  const res = await page.goto(`/vets/${VET_ID}`);
  expect(res?.status()).toBe(200);
  // SSR sets the title to "<Vet Name> — Pawliz"; the generic fallback is
  // "Vet Profile — Pawliz". A non-fallback title proves the vet resolved.
  await expect(page).not.toHaveTitle(/^Vet Profile — Pawliz$/);
  await expect(page).toHaveTitle(/Pawliz/);
});

test("vet detail renders the vet name in the page body", async ({ page }) => {
  await page.goto(`/vets/${VET_ID}`);
  // The client VetDetailPage mounts and shows the vet's name. Vet id 14 is
  // "VET VENUE" in the dev DB. Assert on the visible name text (the name is a
  // styled div, not a semantic heading, so match by text).
  await expect(page.getByText(/VET VENUE/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("unknown vet id still returns the page (graceful fallback)", async ({ page }) => {
  const res = await page.goto("/vets/99999999");
  // SSR fail-safe returns the page with the generic title rather than 500.
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Pawliz/);
});
