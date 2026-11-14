import {
  E2E_FAKE_KEY,
  MOCK_BASE_URL,
  ensureAuth,
  expect,
  nav,
  test,
} from "./support/helpers";

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

test.describe("provider keys", () => {
  test("adds a provider with a fake key and imports its models", async ({
    page,
  }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /^Providers/ }).click();
    await page.getByRole("button", { name: "+ Add provider" }).click();

    await page.getByLabel("Display name").fill("Mock Provider");
    // Field-wrapped controls pick up hint/option text into their label, so
    // anchor these matches at the start of the label.
    await page.getByLabel(/^Type/).selectOption("local");
    await page.getByLabel(/^Base URL/).fill(`${MOCK_BASE_URL}/v1`);
    await page.getByLabel(/^API key/).fill(E2E_FAKE_KEY);
    await page.getByRole("button", { name: /Save provider/ }).click();

    await expect(page.getByText("Provider added")).toBeVisible();
    const card = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Mock Provider" }) });
    await expect(card).toHaveCount(1);

    // The card must show only a masked preview, never the raw key.
    await expect(card.getByText(/^key sk-e2/)).toBeVisible();
    await expect(page.getByText(E2E_FAKE_KEY)).toHaveCount(0);

    // Talking to the stubbed provider validates the key end to end.
    await card.getByRole("button", { name: /^Test/ }).click();
    await expect(card.getByText(/ms · 2 models/)).toBeVisible();

    await card.getByRole("button", { name: "Import models" }).click();
    await expect(
      page.getByText("Imported 2 new models (0 already known)"),
    ).toBeVisible();
  });
});
