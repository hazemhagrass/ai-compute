import { ensureAuth, expect, nav, test } from "./support/helpers";

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

test.describe("playground", () => {
  test("runs a prompt through a model and shows the streamed reply", async ({
    page,
  }) => {
    await page.goto("/");
    await nav(page).getByRole("button", { name: /^Playground/ }).click();

    await page.getByLabel("Model", { exact: true }).selectOption({
      label: "mock-alpha",
    });
    await page.getByLabel("Prompt", { exact: true }).fill("Say hello");
    await page.getByRole("button", { name: "Run", exact: true }).click();

    await expect(
      page.getByText("MOCK_ALPHA_REPLY hello from the stubbed provider"),
    ).toBeVisible();
    await expect(page.getByText(/Conversation totals \(1 turn/)).toBeVisible();
    // Zero-priced discovered model: usage is counted, cost stays $0.0000.
    await expect(page.getByText(/200 tokens \(100 in \/ 100 out\)/)).toBeVisible();
    await expect(page.getByText(/\$0\.0000/)).toBeVisible();
  });
});
