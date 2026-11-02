import { expect, test } from "@playwright/test";

import { expectSignedOut, signIn, testUser } from "./helpers";

// These run without the saved session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("signed out", () => {
  for (const path of ["/", "/my-banks", "/transaction-history", "/payment-transfer", "/settings"]) {
    test(`${path} redirects to sign-in`, async ({ page }) => {
      await page.goto(path);
      await expectSignedOut(page);
    });
  }

  test("a forged session cookie does not get in", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "appwrite-session", value: "forged", url: baseURL! }]);

    await page.goto("/settings");
    await expectSignedOut(page);
  });

  test("the sign-in page runs under the CSP without violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
    });

    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");
    // Hydrated: the client-side validation works
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator(".form-message").first()).toBeVisible();

    expect(violations).toEqual([]);
  });

  test("sign-in validates before submitting", async ({ page }) => {
    await page.goto("/sign-in");
    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");

    // The browser's own check on the email field stops the submit first
    await email.fill("not-an-email");
    await password.fill("short");
    await page.getByRole("button", { name: "Sign In" }).click();
    expect(await email.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);

    // Then the form's schema rejects the short password
    await email.fill("someone@example.com");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.locator(".form-message").filter({ hasText: /8/ })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a wrong password shows an error", async ({ page }) => {
    await signIn(page, testUser().email, "definitely-not-the-password");

    await expect(page.getByRole("alert").filter({ hasText: /invalid credentials/i })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("sign-up checks the details in the browser", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Date of Birth").fill("2999-01-01");
    await page.getByRole("button", { name: "Sign Up" }).click();

    await expect(page.getByText("Enter a real date in the past")).toBeVisible();
    await expect(page.getByText("Address is required")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});
