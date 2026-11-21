import { E2E_PASSWORD, expect, nav, test } from "./support/helpers";

// Serial: the first test seeds the password the second one signs in with.
test.describe.configure({ mode: "serial" });

test.describe("login", () => {
  test("first run sets the dashboard password and enters the dashboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: /AI Model Router/ }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Set a password. It guards your stored API keys and your prompt history.",
      ),
    ).toBeVisible();

    // Mismatched confirmation must be refused before the real setup.
    await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
    await page.getByLabel("Confirm password").fill(`${E2E_PASSWORD}-other`);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByText("Passwords do not match.")).toBeVisible();

    await page.getByLabel("Confirm password").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Set password" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      nav(page).getByRole("button", { name: /^Playground/ }),
    ).toBeVisible();
    await expect(
      nav(page).getByRole("button", { name: /^Providers/ }),
    ).toBeVisible();
  });

  test("a signed-out visit rejects a wrong password, then signs in", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Sign in to continue.")).toBeVisible();

    await page
      .getByLabel("Password", { exact: true })
      .fill("wrong-password-attempt");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      nav(page).getByRole("button", { name: /^Compare/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /AI Model Router/ })).toBeVisible();
  });
});
