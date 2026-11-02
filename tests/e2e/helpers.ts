import { expect, type Page } from "@playwright/test";

export const testUser = () => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local to a sandbox account (see .env.example).");
  }

  return { email, password };
};

export const signIn = async (page: Page, email: string, password: string) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
};

export const expectSignedOut = async (page: Page) => {
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible();
};
