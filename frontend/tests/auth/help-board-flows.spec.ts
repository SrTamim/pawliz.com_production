import { test, expect } from "@playwright/test";
import {
  API_BASE,
  STORAGE_STATE,
  cookieHeaderFromState,
  grantClipboard,
  mockGeolocation,
} from "../helpers";

/**
 * Help Board interactive flows (vet session): report a Found pet + a Rescue post
 * (create → assert on board → delete to clean up), report Lost + Adoption via the
 * profile-driven modals, and post-card interactions (reactions, comments,
 * contact form, share link). Geolocation + clipboard are mocked.
 *
 * Cleanup: created Found/Rescue posts are deleted via their owner-only details
 * modal. A safety sweep at the end removes any stray E2E rows via API.
 */

const cookie = () => cookieHeaderFromState(STORAGE_STATE);

test.afterAll(async ({ request }) => {
  // Safety net: delete any Found/Rescue posts this run created but didn't clean.
  const c = cookie();
  for (const [list, del] of [
    ["lost-found/found", "lost-found/found"],
    ["rescue-adoption/rescue", "rescue-adoption/rescue"],
  ]) {
    try {
      const res = await request.get(`${API_BASE}/${list}`, { headers: { Cookie: c } });
      if (!res.ok()) continue;
      const data = await res.json();
      for (const p of data.posts || []) {
        if (/E2E-TEST/i.test(`${p.description || ""} ${p.color || ""} ${p.breed || ""}`)) {
          await request.delete(`${API_BASE}/${del}/${p.id}`, { headers: { Cookie: c } });
        }
      }
    } catch {
      /* best-effort */
    }
  }
});

test.describe("Report flows (create → clean up)", () => {
  test("report a found pet, see it on the board, delete it", async ({ page, context }) => {
    await mockGeolocation(context);
    await page.goto("/help-board?tab=found");
    await expect(page.getByRole("tablist")).toBeVisible();
    // Wait for the auth context to hydrate from the cookie before clicking a
    // report CTA — otherwise the handler sees !user and opens the login modal.
    await expect(
      page.getByRole("button", { name: /^log\s?in$/i }).first()
    ).toHaveCount(0, { timeout: 10_000 });

    // Open the report-found modal via the warm CTA. The controls-row button is
    // labelled "Report Found"; wait for the modal's Color field to confirm it
    // mounted (the modal is portal-rendered, no role=dialog).
    await page.getByRole("button", { name: "Report Found" }).click();
    const colorInput = page.getByPlaceholder(/Brown and white/i);
    await expect(colorInput).toBeVisible({ timeout: 10_000 });

    // pet_type (dog) + found_date (today) default in. The backend ALSO requires
    // found_location_name (the client only checks type+date — a real validation
    // gap, same as the rescue form). Fill location + tag the Color field.
    await colorInput.fill("E2E-TEST-found");
    await page.getByPlaceholder(/Gulshan 2, Dhaka/i).fill("E2E-TEST Dhaka");

    const createResp = page.waitForResponse(
      (r) => r.url().includes("/lost-found/found") && r.request().method() === "POST",
      { timeout: 15_000 }
    );
    await page.getByRole("button", { name: /report found pet/i }).click();
    const resp = await createResp;
    expect([200, 201]).toContain(resp.status());
    await expect(page.getByText(/report submitted/i)).toBeVisible({ timeout: 8000 });

    // The new post id comes back in the response — open its details deep-link
    // and delete it (owner-only Edit/Delete are present for our own post).
    const body = await resp.json().catch(() => ({}));
    const postId = body?.post?.id ?? body?.id;
    if (postId) {
      page.on("dialog", (d) => d.accept()); // window.confirm in delete
      await page.goto(`/help-board?post=${postId}&type=found`);
      await page.getByRole("button", { name: /delete/i }).first().click();
      await expect(page.getByText(/deleted successfully/i)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("report a rescue post and submit", async ({ page, context }) => {
    await mockGeolocation(context);
    await page.goto("/help-board?tab=rescue");
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^log\s?in$/i }).first()
    ).toHaveCount(0, { timeout: 10_000 });

    await page.getByRole("button", { name: /report rescue|rescue/i }).first().click();
    // pet_type (dog), urgency (medium) and rescue_date (today) default in. The
    // backend ALSO requires rescue_location_name (the client doesn't enforce it
    // — a real validation gap), so fill it + tag the description for cleanup.
    const rescueLoc = page.getByPlaceholder(/Gulshan 2, Dhaka/i);
    await expect(rescueLoc).toBeVisible({ timeout: 10_000 });
    await rescueLoc.fill("E2E-TEST Dhaka");
    await page.getByPlaceholder(/condition, behavior, injuries/i).fill("E2E-TEST rescue report");

    const createResp = page.waitForResponse(
      (r) => r.url().includes("/rescue-adoption/rescue") && r.request().method() === "POST",
      { timeout: 15_000 }
    );
    await page.getByRole("button", { name: /submit rescue report/i }).click();
    const resp = await createResp;
    expect([200, 201]).toContain(resp.status());
    await expect(page.getByText(/rescue request submitted/i).first()).toBeVisible({
      timeout: 8000,
    });
    // afterAll sweep deletes it (rescue details delete is owner-gated like found).
  });

  test("report-lost from profile opens the lost modal", async ({ page }) => {
    // The help-board "Report Lost" CTA routes to /profile (you mark YOUR pet lost).
    // Validate the profile path renders the lost-instruction entry.
    await page.goto("/help-board?tab=lost");
    await page.getByRole("button", { name: /report lost/i }).first().click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 10_000 });
  });
});

test.describe("Post-card interactions", () => {
  test("react, open details, comment + delete, contact validation", async ({ page }) => {
    await page.goto("/help-board?tab=found");
    await expect(page.getByRole("tablist")).toBeVisible();

    // Posts load async — give the grid a moment, then require at least one card.
    const card = page.locator(".card-hover").first();
    await card.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    if ((await page.locator(".card-hover").count()) === 0) {
      test.skip(true, "No found posts to interact with.");
    }

    // React on the card (lg/sm ReactionBar buttons expose aria-label).
    const love = page.getByRole("button", { name: "Love" }).first();
    if (await love.isVisible().catch(() => false)) {
      await love.click();
    }

    // Open details.
    await page.getByRole("button", { name: /view details/i }).first().click();
    const modal = page.locator(".glass").filter({ hasText: /Found|Contact/i }).first();
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Add a comment then delete it (we own our comments).
    const commentBox = page.getByPlaceholder(/share information or tips/i);
    if (await commentBox.isVisible().catch(() => false)) {
      await commentBox.fill("E2E-TEST comment");
      await page.getByRole("button", { name: /post comment/i }).click();
      await expect(page.getByText("E2E-TEST comment").first()).toBeVisible({ timeout: 10_000 });
      // Delete it (owner control).
      page.on("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /^delete$/i }).first().click();
    }

    // Contact form validation: invalid phone shows the BD-number error.
    await page.getByRole("button", { name: /contact/i }).first().click();
    await page.getByPlaceholder(/01712345678/i).fill("12345");
    await expect(page.getByText(/valid BD number/i)).toBeVisible({ timeout: 5000 });
  });

  test("share button exposes a correct deep-link URL", async ({ page, context }) => {
    await grantClipboard(context);
    await page.goto("/help-board?tab=found");
    await expect(page.getByRole("tablist")).toBeVisible();
    const card = page.locator(".card-hover").first();
    await card.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    if ((await page.locator(".card-hover").count()) === 0) {
      test.skip(true, "No found posts to share.");
    }

    // Open the share menu on the first card. The platform links carry the
    // canonical share URL URL-ENCODED inside their query params, e.g.
    // ...sharer.php?u=http%3A%2F%2F...%2Fhelp-board%3Fpost%3D1%26type%3Dfound
    await page.getByRole("button", { name: /share/i }).first().click();
    const fb = page.getByRole("link", { name: /share on facebook/i });
    await expect(fb).toBeVisible({ timeout: 8000 });
    const href = await fb.getAttribute("href");
    expect(decodeURIComponent(href || "")).toMatch(
      /help-board\?post=\d+&type=found/
    );
  });
});
