import { test, expect } from "@playwright/test";
import { TEST_USER } from "../helpers";

/**
 * Authenticated profile suite (runs in the chromium-auth project, which loads
 * the saved login session — see auth.setup.ts).
 *
 * Covers: completion/progress, edit user info, password-change validation,
 * and the full add-pet → QR → share → edit → delete lifecycle (create + clean
 * up, so the dev DB isn't polluted on a passing run).
 *
 * The test account is a 'vet' user; the profile page still renders the normal
 * owner UI (pets, account form), so these flows apply.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/profile");
  // Account edit card is the always-visible anchor that the page renders once
  // the profile loads.
  await expect(page.locator(".pf-page")).toBeVisible({ timeout: 20_000 });
});

test("profile loads with name and completion ring", async ({ page }) => {
  // Header shows the user's name. Assert on the seeded name rather than mere
  // visibility: an empty <h1> renders as "hidden" and would fail with a vague
  // message, masking the real cause (an account row with no name — reseed via
  // backend/database/seed.ts, which now upserts name/occupation/role).
  // Exact match (not toContainText): the profile <h1> renders ONLY the name
  // (frontend/src/pages/profile.tsx) — phone/occupation are separate sibling
  // elements. Keeping exact match catches a stray suffix leaking into the
  // heading as a regression. If the h1 is ever meant to hold extra text,
  // update this assertion deliberately.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TEST_USER.name);
  // Completion percentage ring renders a "NN%" indicator.
  await expect(page.locator(".completion")).toBeVisible();
});

test("edit user info — change occupation then revert", async ({ page }) => {
  // The account form inputs are plain .input-field controls. The occupation
  // field's placeholder is the example copy "Software Engineer".
  const occupation = page.getByPlaceholder("Software Engineer");
  await expect(occupation).toBeVisible();
  const original = await occupation.inputValue();

  await occupation.fill("E2E-TEST-occupation");
  // Manual save button ("Save changes" via common:buttons.saveChanges).
  await page.getByRole("button", { name: /save changes/i }).first().click();
  // A success toast confirms the backend accepted the update.
  await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 10_000 });

  // Revert so the account is left unchanged.
  await occupation.fill(original);
  await page.getByRole("button", { name: /save changes/i }).first().click();
  await expect(page.getByText(/updated successfully/i).first()).toBeVisible({ timeout: 10_000 });
});

test("password change form validates mismatch", async ({ page }) => {
  await page.getByRole("button", { name: /change password/i }).click();
  // The sub-form appears with three password fields.
  const form = page.locator("form");
  await form.locator('input[type="password"]').nth(0).fill("User@123");
  await form.locator('input[type="password"]').nth(1).fill("NewPass123");
  await form.locator('input[type="password"]').nth(2).fill("Different123");
  await page.getByRole("button", { name: /update password/i }).click();
  // Client-side guard toasts a mismatch — the working password is never changed.
  await expect(page.getByText(/do not match/i)).toBeVisible({ timeout: 8000 });
});

test("add pet → QR → share → delete lifecycle", async ({ page }) => {
  const petName = `E2E-TEST-${Date.now()}`;

  // Open the inline add-pet form via the header "Add a pet" button (exact name
  // so it doesn't collide with the form's "🐾 Add Pet" submit button).
  await page.getByRole("button", { name: "Add a pet" }).click();

  // The new-pet form's name field uses the "Buddy" placeholder.
  const nameInput = page.getByPlaceholder("Buddy");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(petName);

  // NOTE (real finding): the backend rejects gender:"" with 400 ("Gender must
  // be male, female, or unknown"), but the form leaves gender blank by default.
  // Submitting name-only therefore fails. We pick a gender so the happy path
  // succeeds; see the "name-only submit is rejected" test below for the bug.
  await page.locator("select").filter({ hasText: "Male" }).first().selectOption("male");

  // Submit — the form's button label is "🐾 Add Pet". Wait for the create POST
  // so we assert on the real backend round-trip, not a transient toast.
  const createResp = page.waitForResponse(
    (r) => r.url().includes("/v1/pets") && r.request().method() === "POST",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: /Add Pet/ }).click();
  const resp = await createResp;
  expect(resp.status()).toBe(201);

  // The new pet card is now present. Scope to it via its name text.
  const petCard = page
    .locator("div", { hasText: petName })
    .filter({ has: page.locator('button[title="QR Code"]') })
    .last();

  // QR: toggle the QR panel and assert the QR image renders for this pet.
  await page.locator('button[title="QR Code"]').last().click();
  await expect(page.locator('img[alt^="QR for"]').last()).toBeVisible({
    timeout: 8000,
  });

  // Share: toggle the share panel and assert the public /pet/ link shows.
  // (Button title is the i18n string "Share pet profile".)
  await page.locator('button[title="Share pet profile"]').last().click();
  await expect(page.getByText(/\/pet\//).last()).toBeVisible({ timeout: 8000 });

  // Cleanup — delete the pet via the Remove (🗑️) button + confirm modal.
  await page.locator('button[title="Remove"]').last().click();
  // The confirm modal's "Remove" button is the last one (the icon button also
  // exposes title="Remove", so disambiguate with .last()).
  await page.getByRole("button", { name: /^remove$/i }).last().click();
  await expect(page.getByText(new RegExp(`${petName} removed`, "i"))).toBeVisible({
    timeout: 10_000,
  });
});

test("add-pet name-only submit is rejected by the backend (gender required)", async ({
  page,
}) => {
  // Regression guard for the finding above: with only a name filled, the form
  // POSTs gender:"" and the backend returns 400. This documents current
  // behavior — if the form is fixed to omit empty gender, update to expect 201.
  await page.getByRole("button", { name: "Add a pet" }).click();
  await page.getByPlaceholder("Buddy").fill(`E2E-TEST-namebug-${Date.now()}`);

  const createResp = page.waitForResponse(
    (r) => r.url().includes("/v1/pets") && r.request().method() === "POST",
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: /Add Pet/ }).click();
  const resp = await createResp;
  expect(resp.status()).toBe(400);
  // The form stays open and surfaces the backend error to the user.
  await expect(page.getByText(/gender must be/i)).toBeVisible({ timeout: 8000 });
});
