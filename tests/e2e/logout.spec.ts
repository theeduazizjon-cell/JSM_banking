import { test } from "@playwright/test";

import { expectSignedOut } from "./helpers";

test("logging out ends the session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Log out" }).filter({ visible: true }).click();

  await expectSignedOut(page);

  // The old session no longer works
  await page.goto("/settings");
  await expectSignedOut(page);
});
