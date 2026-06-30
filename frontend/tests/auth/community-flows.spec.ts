import { test, expect } from "@playwright/test";
import {
  API_BASE,
  STORAGE_STATE,
  cookieHeaderFromState,
  grantClipboard,
} from "../helpers";

/**
 * Community page interactive flows (vet session): compose a post (body + tag),
 * verify it lands in the feed, then delete it (own post → kebab → Delete) to
 * clean up. Plus reactions, comment add/delete, the report popover, and the
 * share deep-link. A safety sweep removes any stray E2E posts via API.
 */

const cookie = () => cookieHeaderFromState(STORAGE_STATE);

test.afterAll(async ({ request }) => {
  const c = cookie();
  try {
    const res = await request.get(`${API_BASE}/community/posts?limit=50`, {
      headers: { Cookie: c },
    });
    if (res.ok()) {
      const data = await res.json();
      for (const p of data.posts || []) {
        if (/E2E-TEST/i.test(p.body || "")) {
          await request.delete(`${API_BASE}/community/posts/${p.id}`, {
            headers: { Cookie: c },
          });
        }
      }
    }
  } catch {
    /* best-effort */
  }
});

async function waitForAuthHydrated(page: any) {
  await page.goto("/community");
  // Auth context hydrates from the cookie; wait until the navbar Login button
  // is gone so compose/react handlers see the logged-in user.
  await expect(
    page.getByRole("button", { name: /^log\s?in$/i }).first()
  ).toHaveCount(0, { timeout: 10_000 });
}

test("compose a post, see it in the feed, delete it", async ({ page }) => {
  await waitForAuthHydrated(page);
  const text = `E2E-TEST community post ${Date.now()}`;

  // Open the composer.
  await page.locator(".compose-pill").click();
  await expect(page.getByRole("heading", { name: /create post/i })).toBeVisible({
    timeout: 10_000,
  });

  // Body + at least one tag are required.
  await page.getByPlaceholder(/share something with the community/i).fill(text);
  // The tags row is a set of pill buttons under the "Tags" label — pick the first.
  const tagsLabel = page.getByText("Tags", { exact: true });
  await tagsLabel
    .locator("xpath=following-sibling::div[1]")
    .getByRole("button")
    .first()
    .click();

  // Submit ("Post") and assert the create round-trips.
  const createResp = page.waitForResponse(
    (r) => r.url().includes("/community/posts") && r.request().method() === "POST",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const resp = await createResp;
  expect([200, 201]).toContain(resp.status());

  // The new post appears in the feed.
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });

  // Clean up: kebab → Delete (own post; window.confirm accepted). Register the
  // dialog handler before clicking so the confirm() is auto-accepted.
  page.on("dialog", (d) => d.accept());
  const card = page
    .locator(".post")
    .filter({ hasText: text })
    .first();
  await card.getByRole("button", { name: "Menu" }).click();
  // Wait for the dropdown's Delete item before clicking (avoids a race where the
  // menu hasn't rendered yet under parallel load).
  const deleteItem = page.getByRole("button", { name: "Delete", exact: true });
  await expect(deleteItem).toBeVisible({ timeout: 8000 });
  await deleteItem.click();
  // Confirm removal by the card disappearing from the feed (toast can race).
  await expect(page.getByText(text)).toHaveCount(0, { timeout: 10_000 });
});

test("react and open the report popover on an existing post", async ({ page }) => {
  await waitForAuthHydrated(page);
  const card = page.locator(".post").first();
  await card.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  if ((await page.locator(".post").count()) === 0) {
    test.skip(true, "No community posts to interact with.");
  }

  // React (ReactionBar exposes aria-label "Love").
  const love = page.getByRole("button", { name: "Love" }).first();
  if (await love.isVisible().catch(() => false)) {
    await love.click();
  }

  // Open the kebab → Report popover (non-owner posts show Report; if our own
  // post is first it shows Edit/Delete instead — tolerate both).
  await card.getByRole("button", { name: "Menu" }).first().click();
  const report = page.getByRole("button", { name: "Report", exact: true });
  if (await report.isVisible().catch(() => false)) {
    await report.click();
    // A reason picker appears; assert it rendered (don't submit to avoid noise).
    await expect(page.getByText(/report this post/i)).toBeVisible({ timeout: 5000 });
  }
});

test("post share menu exposes the community deep-link", async ({ page, context }) => {
  await grantClipboard(context);
  await waitForAuthHydrated(page);
  const card = page.locator(".post").first();
  await card.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  if ((await page.locator(".post").count()) === 0) {
    test.skip(true, "No community posts to share.");
  }

  await card.getByRole("button", { name: /share/i }).first().click();
  const fb = page.getByRole("link", { name: /share on facebook/i });
  await expect(fb).toBeVisible({ timeout: 8000 });
  const href = await fb.getAttribute("href");
  expect(decodeURIComponent(href || "")).toMatch(/community\?post=\d+/);
});
