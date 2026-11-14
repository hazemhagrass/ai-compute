import { ensureAuth, expect, nav, test } from "./support/helpers";

test.beforeEach(async ({ context }) => {
  await ensureAuth(context.request);
});

// One test, ordered steps: price a model, set a tight budget, spend past the
// 80% warning threshold, then clean the budget up so later specs see a
// clean slate.
test.describe("budget warning", () => {
  test("warns at 80% of a budget before calls would be refused", async ({
    page,
  }) => {
    await page.goto("/");

    // Price mock-alpha at $400 / 1M output tokens so one stubbed call (100
    // output tokens) costs $0.04 against the budget.
    await nav(page).getByRole("button", { name: /^Models/ }).click();
    await page
      .getByPlaceholder("Filter models, providers, tags…")
      .fill("mock-alpha");
    const modelRow = page.locator("tr", { hasText: "mock-alpha" });
    await modelRow.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Output $ / 1M tokens").fill("400");
    await page.getByRole("button", { name: /Save model/ }).click();
    await expect(page.getByText("Model saved")).toBeVisible();

    // A $0.05 daily budget: the first call uses 80% of it.
    await nav(page).getByRole("button", { name: /^Settings/ }).click();
    await page.getByLabel("Budget label").fill("e2e smoke");
    await page.getByLabel("Budget period").selectOption("daily");
    await page.getByLabel("Budget limit in dollars").fill("0.05");
    await page.getByRole("button", { name: "Add budget" }).click();
    const budgetRow = page
      .getByRole("row")
      .filter({ hasText: "e2e smoke" });
    await expect(budgetRow).toBeVisible();

    // First call: $0.04 of $0.05 spent, no warning yet.
    await nav(page).getByRole("button", { name: /^Playground/ }).click();
    await page
      .getByLabel("Model", { exact: true })
      .selectOption({ label: "mock-alpha" });
    await page.getByLabel("Prompt", { exact: true }).fill("first burn");
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(page.getByText(/Conversation totals \(1 turn/)).toBeVisible();
    await expect(page.getByText(/\$0\.0400/)).toBeVisible();

    // Second call crosses the 80% threshold and must surface the warning.
    await page.getByLabel("Prompt", { exact: true }).fill("second burn");
    await page
      .getByRole("button", { name: "Send", exact: true })
      .click();
    await expect(
      page.getByText(/Budget at 80% for this period/),
    ).toBeVisible();

    // Cleanup: drop the budget and confirm the empty state returns.
    await nav(page).getByRole("button", { name: /^Settings/ }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "e2e smoke" })
      .getByRole("button", { name: "delete" })
      .click();
    await expect(
      page.getByText("No budgets. Calls are unthrottled until one is set."),
    ).toBeVisible();
  });
});
