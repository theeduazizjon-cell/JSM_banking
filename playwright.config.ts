import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// The sandbox test account (TEST_USER_EMAIL / TEST_USER_PASSWORD) lives in
// .env.local next to the app's other settings; see .env.example.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// E2E_BASE_URL tests an already deployed site (no local server is started);
// otherwise a local dev server is used, on E2E_PORT if set.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const remoteURL = process.env.E2E_BASE_URL?.replace(/\/$/, "");
const baseURL = remoteURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Pages talk to Appwrite and Plaid sandboxes, which can be slow in dev mode
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    // Uses the installed Google Chrome, so no browser download is needed.
    // Run `npx playwright install chromium` and remove this line to use Playwright's own build.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "app",
      testIgnore: /auth\.setup\.ts|logout\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: "playwright/.auth/user.json" },
    },
    // Logging out ends the shared session, so it runs after everything else
    {
      name: "logout",
      testMatch: /logout\.spec\.ts/,
      dependencies: ["app"],
      use: { storageState: "playwright/.auth/user.json" },
    },
  ],
  webServer: remoteURL ? undefined : {
    command: `npm run dev -- --port ${PORT}`,
    url: `${baseURL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
