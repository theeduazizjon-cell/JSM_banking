import { expect, test as setup } from "@playwright/test";

import { signIn, testUser } from "./helpers";

setup("sign in as the sandbox test user", async ({ page }) => {
  const { email, password } = testUser();

  await signIn(page, email, password);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();

  await page.context().storageState({ path: "playwright/.auth/user.json" });
});
