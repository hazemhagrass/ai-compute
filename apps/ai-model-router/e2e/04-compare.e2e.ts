import { ensureAuth, expect, nav, test } from "./support/helpers";

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

test.describe("compare", () => {
  test("sends one prompt to two models and shows both replies", async ({
    page,
  }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /^Compare/ }).click();

    await page
      .getByLabel("Model A", { exact: true })
      .selectOption({ label: "mock-alpha" });
    await page
      .getByLabel("Model B", { exact: true })
      .selectOption({ label: "mock-beta" });
    await page
      .getByLabel("Prompt", { exact: true })
      .fill("Compare me across both models");
    await page.getByRole("button", { name: "Run", exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "mock-alpha" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "mock-beta" }),
    ).toBeVisible();
    await expect(
      page.getByText("MOCK_ALPHA_REPLY hello from the stubbed provider"),
    ).toBeVisible();
    await expect(
      page.getByText("MOCK_BETA_REPLY hello from the stubbed provider"),
    ).toBeVisible();
  });
});
