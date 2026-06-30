import { test, expect } from "@playwright/test";
import { API_BASE, STORAGE_STATE, cookieHeaderFromState } from "../helpers";

/**
 * Authenticated clinic review (vet session). Submits a real review on a vet
 * detail page and verifies the success path, then deletes it via API so the
 * dev DB is left clean. Reviews have no UI delete/report control (read-only
 * display), so cleanup goes through the owner-delete API endpoint.
 */

const VET_ID = 14;

test("submitting a review requires a star rating", async ({ page }) => {
  await page.goto(`/vets/${VET_ID}`);
  // The write-a-review form is visible because we're logged in.
  await expect(page.getByText(/write a review/i)).toBeVisible({ timeout: 15_000 });
  // Click submit with no rating -> validation toast, no write.
  await page.getByRole("button", { name: /submit review/i }).click();
  await expect(page.getByText(/select a star rating/i)).toBeVisible({
    timeout: 8000,
  });
});

test("submit a real review, then clean it up via API", async ({ page, request }) => {
  await page.goto(`/vets/${VET_ID}`);
  await expect(page.getByText(/write a review/i)).toBeVisible({ timeout: 15_000 });

  // The review form is the container holding the comment textarea. Scope star
  // clicks to it so we don't hit the rating-FILTER buttons (which also contain
  // "★", e.g. "5★"). StarInput buttons are exactly "★"; click the 5th.
  const reviewForm = page
    .locator("div")
    .filter({ has: page.locator("textarea.input-field") })
    .last();
  await reviewForm.getByRole("button", { name: "★", exact: true }).nth(4).click();

  await page
    .locator("textarea.input-field")
    .fill("E2E-TEST automated review — please ignore.");

  // Capture the create response to get the review id for cleanup.
  const addResp = page.waitForResponse(
    (r) => r.url().includes("/reviews") && r.request().method() === "POST",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: /submit review/i }).click();
  const resp = await addResp;
  expect([200, 201]).toContain(resp.status());
  await expect(page.getByText(/review submitted/i)).toBeVisible({ timeout: 8000 });

  // Cleanup: find this user's review on the vet and delete it via the owner API.
  const cookie = cookieHeaderFromState(STORAGE_STATE);
  const list = await request.get(`${API_BASE}/reviews?vet_id=${VET_ID}`, {
    headers: { Cookie: cookie },
  });
  if (list.ok()) {
    const data = await list.json();
    const mine = (data.reviews || []).find((rv: any) =>
      String(rv.comment || "").includes("E2E-TEST")
    );
    if (mine) {
      const del = await request.delete(`${API_BASE}/reviews/${mine.id}`, {
        headers: { Cookie: cookie },
      });
      expect(del.ok()).toBeTruthy();
    }
  }
});
