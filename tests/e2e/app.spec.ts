import { expect, test } from "@playwright/test";

import { testUser } from "./helpers";

test("the dashboard greets the user", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Dashboard · Ledgerly");
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});

test("the navigation reaches every page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation").first();

  for (const [link, title] of [
    ["My Banks", "My Banks · Ledgerly"],
    ["Transaction History", "Transaction History · Ledgerly"],
    ["Transfer Funds", "Transfer Funds · Ledgerly"],
    ["Settings", "Settings · Ledgerly"],
  ]) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page).toHaveTitle(title);
    await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
  }
});

test("settings shows the signed-in user's profile", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: testUser().email })).toBeVisible();
});

test("the change password form validates in the browser", async ({ page }) => {
  await page.goto("/settings");
  await page.getByLabel("Current password").fill("anything");
  await page.getByLabel("New password", { exact: true }).fill("new-password-1");
  await page.getByLabel("Confirm new password").fill("different-password");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByText("Passwords don't match")).toBeVisible();
});

test("another user's bank ID shows nothing", async ({ page }) => {
  await page.goto("/transaction-history?id=000000000000000000000000");

  await expect(page.getByText("No bank connected yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: /couldn't load/i })).toHaveCount(0);
});

test("pages with no linked bank explain what to do", async ({ page }) => {
  // The sandbox test account has no linked bank while Plaid's Dwolla
  // integration is disabled; skip once one is linked.
  await page.goto("/my-banks");
  const empty = page.getByText(/No banks connected yet/);
  test.skip(!(await empty.isVisible()), "The test account has a linked bank");

  await page.goto("/payment-transfer");
  await expect(page.getByRole("link", { name: "My Banks" }).last()).toHaveAttribute("href", "/my-banks");
});

test("no account details leak into the page payload", async ({ page }) => {
  const response = await page.goto("/settings");
  const html = await response!.text();

  for (const field of ["dwollaCustomerUrl", "dwollaCustomerId", "accessToken", "fundingSourceUrl", "ssn"]) {
    expect(html, `page HTML contains ${field}`).not.toContain(field);
  }
});
