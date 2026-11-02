# Development Progress

Working log for turning jsm_banking into a production-ready portfolio app.
Backup of the pre-work state: git tag `backup/pre-phase3`.

## Status by phase

| Phase | Status |
|---|---|
| 1. Audit | ✅ Done (2026-11-01) |
| 2. Tools and agents | ✅ Built-in tools are enough; dev-only test packages installed in Phase 7 |
| 3. Error fixing and security | ✅ Done; signed-in flows tested except bank linking and transfers (blocked by a Plaid dashboard setting) |
| 4. UI/UX | 🟡 First pass done (theme tokens, accessibility, responsive fixes, empty states); screens with real bank data not yet reviewed |
| 5. Banking features | 🟡 Search/filters, cash-flow analytics and Settings built; filters and analytics untested with real bank data |
| 6. Architecture | 🟡 Partly done (data access layer introduced in Phase 3) |
| 7. Testing | ✅ 114 unit/component tests and 18 end-to-end tests passing; bank linking and transfers covered only by mocked tests |
| 8. Security audit | ✅ Done (2026-11-02); 3 items need your decision (see Remaining issues 2, 3, 9) |
| 9. Documentation | ✅ Done (2026-11-02): README rewritten, `.env.example` matches the code |
| 10. Deployment | 🟡 Prepared (2026-11-02): code ready, `develop` pushed for review; Vercel project not yet created |

## Fixed in Phase 3

### Security
- **Accounts readable by other users.** `/?id=` and `/transaction-history?id=` loaded any bank by ID. `getAccount` now requires the owner's ID and returns null for anyone else.
- **Transfers ran in the browser.** The client fetched bank records (including Plaid access tokens) and called Dwolla with funding-source URLs it chose. Now one server action, `transferFunds`, validates the input, checks the source bank belongs to the session user, resolves the recipient, then calls Dwolla.
- **Data helpers were public endpoints.** Every export in a `"use server"` file is callable from any browser. Before: about 20 such endpoints, including `getUserInfo`, `getBank`, `createBankAccount`, `createTransfer` and the Appwrite admin client factory. After: 6 (`signIn`, `signUp`, `logoutAccount`, `createLinkToken`, `exchangePublicToken`, `transferFunds`), each reading the user from the session cookie. Verified in the build's server-reference manifest.
- **Linking a bank trusted a client-supplied user object.** `exchangePublicToken` and `createLinkToken` now take the user from the session.
- **SSN stored and sent to the browser.** Sign-up no longer stores the SSN (it is forwarded to Dwolla only). Components now get a `PublicUser` (id, name, email) instead of the full user document.
- **Plaid access tokens stored in plaintext.** New tokens are encrypted with AES-256-GCM (`lib/crypto.ts`, `ENCRYPTION_KEY`). Existing plaintext tokens are still readable.
- **Sentry collected request bodies, cookies and user info by default.** That included passwords, SSNs, Plaid/Dwolla secrets and the session cookie. All turned off; trace sampling is 10% in production.
- Sentry example page and API routes removed from production; the API route existed twice (`route.js` and `route.ts`).
- Server-only modules (`appwrite`, `plaid`, `dwolla`, `crypto`, `lib/data/*`) import `server-only`, so importing them from client code fails the build.
- `proxy.ts` redirects visitors without a session cookie (optimistic; real checks stay on the server).
- Sign-in and sign-up input is validated again on the server.

### Dependencies
- `next` 16.3.6 → 16.4.3 (fixed 2 critical RCE advisories and several high ones).
- Removed `cn`. It was an unrelated npm package that `components/ui/button.tsx` and `sheet.tsx` were importing by mistake instead of `@/lib/utils`.
- `shadcn` (a CLI) moved to devDependencies; added `server-only`.
- `npm audit --omit=dev`: 23 vulnerabilities (1 critical) → 5 moderate, all in Sentry's build-time plugin (`glob`/`minimatch`).

### Bugs
- **Logout never redirected.** `logoutAccount` returned `undefined` on success, and the footer only navigated when the result was truthy. The control is now a real `<button>` with a label.
- **Transfers with the default source bank failed validation.** The dropdown showed the first account but never set the form value. The dropdown's default value also used the wrong field.
- Transfer errors are now shown in the form instead of being swallowed. The amount must be a number with up to 2 decimals, greater than 0 and at most $5,000. The note is genuinely optional.
- **Purchases showed as income.** Plaid amounts are positive for money out, but `type` was set to the payment channel. Transactions are now normalised to `debit`/`credit` with absolute amounts.
- Each bank now shows its own linked account and transactions, not the first account of the Plaid item.
- `PLAID_ENV` was ignored (sandbox was hard-coded).
- Transaction status now comes from Plaid's `pending` flag instead of "less than 2 days old".
- Plaid's deprecated `category` falls back to `personal_finance_category`.
- Provider failures used to render a blank page. There is now an error boundary with retry (`app/(root)/error.tsx`) and a loading skeleton.
- Empty states for users with no linked banks (My Banks, Payment Transfer).
- The current user is fetched once per request (React `cache`) instead of twice.
- Removed `console.log` of full account objects in `BankCard`; fixed relative image path in `BankDropdown`.
- `.env.example` now documents every variable the code reads.

### Found while testing signed-in flows (2026-11-01)
- **The Plaid secret was written to server logs.** Plaid's SDK throws Axios errors that include the request headers, and the code logged them raw. Every Plaid call now goes through a wrapper (`lib/plaid.ts`) that rethrows a `PlaidRequestError` with only Plaid's code and message. Dwolla errors are logged as status + message only.
- **The dev server logged server-action arguments.** That included sign-up data with SSN and password. Disabled with `logging.serverFunctions: false`.
- **Plaid Link failures were silent.** Added an `onExit` handler, and the user now sees Plaid's message or the error code instead of nothing (or a raw "status code 400").
- In development, Link could initialise with two different tokens because React ran the effect twice. Stale responses are now ignored.

## Phase 4: UI/UX (first pass, 2026-11-01)

### Fixed
- **Undefined theme tokens.** The shadcn/ui components use about 15 semantic colors (`ring-ring`, `bg-popover`, `border-input`, `text-muted-foreground`, ...) that were never defined, so those classes generated nothing. Inputs had no focus indicator and the select popup had no background. The tokens are now defined from the existing brand palette.
- **No visible keyboard focus** (WCAG 2.4.7). Inputs now show a ring, and all other focusable elements get a 2px brand outline on `:focus-visible`.
- **Unreadable in dark mode.** The design is light-only but did not say so, so browsers in dark mode showed dark text on a dark canvas. Added `color-scheme: light` and an explicit page background.
- `prefers-reduced-motion` is respected.
- Removed two unused font families (Geist, Geist Mono) that were downloaded on every page.
- **Bank tabs on the dashboard** only changed the URL from a `div` click inside a tab button, so the keyboard could not switch banks, and every tab rendered the same list. They are now links with `aria-current`.
- Transaction History gained the same bank switcher (it had no way to change account).
- **Table columns misaligned on phones.** The Channel header was hidden below `md` but its cells were not.
- One `<h1>` per page: logo text is no longer a heading. Fixed a `<p>` nested inside the auth form's `<h1>`.
- Sidebar links keep accessible names and tooltips when collapsed to icons; Connect bank collapses like the other items instead of overflowing.
- The mobile menu button has a label; the mobile menu now has side padding (items and avatar were flush against the edge).
- Decorative images use empty `alt`; pagination reads "Page X of Y" and announces changes.
- Primary buttons and inputs are 44px tall (were 32px), the minimum comfortable touch target.
- The footer no longer shows a pointer cursor across its whole area.
- **Empty states** for the balance chart, Recent transactions, transaction table and Top categories.
- **No way to connect a bank on mobile.** My Banks now has a Connect bank button, and the empty states and "Add Bank" link point there (previously "Add Bank" went to `/`).
- **Transfer confirmation.** The dashboard now shows a status banner after a successful transfer (`?transfer=success` was set but never read).
- Page backgrounds fill the screen on short pages; mobile padding reduced from 32px to 20px.
- Clearer copy on auth pages and the transfer page, stating that this is a sandbox.

### Checked in the browser
- Dashboard, My Banks, Payment Transfer and sign-in/sign-up at 1440px, 1024px and 375px, with the browser in dark mode.
- No horizontal overflow at 375px.
- Tab order and focus rings on the mobile menu and sign-up form.

### Not yet done
- Screens with real bank data (cards, transaction table, doughnut chart, transfer form with the bank dropdown) are unreviewed. No bank can be linked until the Plaid Dwolla integration works.
- A full dark theme (currently intentionally light-only).

## Rebrand to Ledgerly (2026-11-01)
- New name **Ledgerly**, chosen by you; the blue palette is kept. Package name is now `ledgerly`. The folder and Git remote are unchanged.
- New logo mark (`public/icons/logo.svg`, also the favicon): three ledger lines and a balance dot on the brand-blue tile.
- The sign-in/sign-up illustration was a 780 KB embedded screenshot of the tutorial's dashboard, showing the course author's name. It is replaced by an HTML brand panel (`components/AuthBrandPanel.tsx`) with a tagline, a decorative balance card labelled as a sample, and what the app actually does.
- Removed the unused tutorial assets `auth-image.svg` and `jsm.svg`.
- Every "Horizon" reference was renamed. Page metadata now uses a title template (e.g. "My Banks · Ledgerly"), and the description says what the app does.
- Not checked: whether "Ledgerly" is trademarked or already used by another product.

## Phase 5: Banking features (2026-11-02)

### Added
- **Transaction search and filters** on Transaction History: text search (merchant or category), money in/out, category, and a date range. It is a plain GET form, so filters live in the URL: they work without JavaScript, survive reloads and keep working across pagination. Malformed values in the URL are ignored. The page shows a result count and a "no matches" state.
- **Cash-flow analytics** on the dashboard for the selected account: income, expenses and net for the current month, plus a six-month income vs. expenses bar chart (Chart.js, already a dependency). Pending transactions are excluded because their amounts can still change.
- **Settings page** (`/settings`, in the navigation and protected by the proxy): profile details rendered server-side only, and a password change. Appwrite verifies the current password through the user's own session, and the form maps Appwrite errors to clear messages.
- Pure helpers in `lib/transactions.ts` hold the filter and summary logic, so it can be unit-tested.

### Deliberately not added
- **Notifications:** with no real event source (webhooks from Plaid/Dwolla are not configured) they would be fabricated.
- **Profile editing:** name and address were verified with Dwolla at sign-up. Changing them would require updating the Dwolla customer, which is out of scope.

### Verified
- 14 checks of the filter and cash-flow logic with sample data (search, type, category, date range including ISO timestamps, ignoring malformed input, month bucketing, pending exclusion). Run as a script; they become unit tests in Phase 7.
- Settings in the browser: a wrong current password shows "Your current password is incorrect."; a correct change shows "Password updated." and clears the fields. Appwrite then accepts the new password and rejects the old one (`.env.local` updated). No horizontal overflow at 375px.
- Not verified in the browser: the filter form and cash-flow section. Both only render for an account with a linked bank.

## Phase 7: Testing (2026-11-02)

### Tools (dev-only, approved)
- Vitest 4.1 (Vitest 5 needs `@types/node` 22+, and the project pins 20), jsdom, Testing Library (`@testing-library/react` plus its required peer `@testing-library/dom`), Playwright.
- Vitest was installed with `--legacy-peer-deps` to get past an npm 10 resolver crash (`Cannot read properties of null (reading 'edgesOut')`) on Vitest's optional peers. Plain `npm install` and `npm ci` work afterwards.
- Playwright drives the installed Google Chrome (`channel: "chrome"`), so no browser download is needed.
- `npm audit` unchanged: 5 moderate in runtime packages, 25 including dev tools (none added by these packages).

### Commands
| Command | What it runs |
|---|---|
| `npm test` | Unit and component tests (Vitest, no network: Appwrite, Plaid and Dwolla are mocked) |
| `npm run test:e2e` | End-to-end tests in Chrome against `next dev` (real Appwrite sandbox, needs `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env.local`) |
| `npm run typecheck` | `tsc --noEmit` |

### What is covered
- **Transaction logic** (`lib/transactions.ts`): URL filter parsing, search, type/category/date filters, cash-flow buckets, pending exclusion, rounding, year boundaries.
- **Schemas and helpers** (`lib/utils.ts`): transfer amounts (format, zero, negative, over $5,000), shareable IDs, password change rules, sign-up/sign-in validation, date of birth.
- **Token encryption**: round trip, random IV, tamper detection, wrong key, legacy plaintext, invalid keys.
- **Plaid wrapper**: errors are replaced by safe errors with no `PLAID-SECRET`; user-facing messages.
- **Data layer**: bank ownership (both relationship shapes), access token encrypted on write and decrypted on read, no Plaid call for someone else's bank, merging transfers with Plaid transactions, sync pagination and category mapping, session lookup.
- **Server actions**: `transferFunds` (session, server-side validation, ownership, unknown/same account, Dwolla failure records nothing), sign-in cookie flags, sign-up never stores the SSN or password and cleans up on Dwolla failure, logout with an expired session, Plaid actions require a session, password change error mapping.
- **Components**: ChangePasswordForm, CashFlowSummary, TransactionFilters, TransactionsTable, Pagination (keeps the bank and filters across pages).
- **End to end**: every protected page redirects when signed out, forged cookie rejected, sign-in/sign-up validation, wrong password, sign-in, navigation and page titles, Settings profile, another user's bank ID, empty states, no private fields in the HTML, logout ends the session.
- Two deliberate breakages (removing the bank ownership check, skipping server-side transfer validation) each made tests fail, so the tests do catch regressions.

### Bug found by the tests
- `getOwnedBank` and `getUserInfo` crashed on an empty Appwrite result (`parseStringify(undefined)`), so an unknown bank ID in the URL showed the error page instead of being treated as not found. Both now return null/undefined.

### Not covered
- Bank linking and real transfers end to end (blocked by remaining issue 1); they are covered only with mocks.
- Sign-up end to end is not automated, because each run would create a real Dwolla sandbox customer.
- Each e2e run creates 2 Appwrite sessions plus 1 failed attempt; Appwrite rate-limits sign-ins per email, so avoid running it many times in a row.

## Phase 8: Security audit (2026-11-02)

### Checked
| Area | Result |
|---|---|
| Secrets in git history (all 22+ commits, every branch) | ✅ No keys, passwords or tokens of yours. 4 hard-coded Plaid sandbox tokens from the tutorial's first commit belong to another Plaid account (Plaid rejects them for yours); removed from the code, history left as is |
| `.env*` files | ✅ All ignored by git, never committed |
| CSRF on server actions | ✅ Next.js rejects a forged `Origin` ("Invalid Server Actions request"); session cookie is `SameSite=Strict` |
| Session cookie | ✅ `HttpOnly`, `Secure`, `SameSite=Strict` |
| Authorization (IDOR) | ✅ Every bank lookup checks ownership (covered by unit and e2e tests since Phase 7) |
| XSS sinks, open redirects | ✅ No `dangerouslySetInnerHTML`, `eval` or user-controlled redirects |
| Appwrite collections | ✅ No public permissions; only the server's API key can read or write |
| Data at rest | ✅ No plaintext Plaid tokens stored. One SSN value remains on the original account (remaining issue 2) |
| Sentry | ✅ No user info, cookies, bodies or Plaid headers sent; Session Replay masks all text and media |

### Found and fixed
1. **No brute-force protection on sign-in (high).** Appwrite doesn't rate-limit requests made with an API key: 12 wrong passwords in a row all returned 401, never 429. Added in-memory rate limits (`lib/rate-limit.ts`):
   - sign-in: 5 failed attempts per email per 15 minutes, 30 attempts per IP;
   - sign-up: 5 per IP per hour;
   - password change: 5 wrong current passwords per user per 15 minutes;
   - transfers: 10 per user per hour.
   Only real wrong-password responses count towards the email lockout, not outages.
2. **No security headers (medium).** Added:
   - a nonce-based Content Security Policy, set per request in `proxy.ts` as the Next.js 16 docs describe;
   - HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`;
   - removed `X-Powered-By`.
   Every page now renders per request so it can carry the nonce. Plaid Link's loader is allowed through `'strict-dynamic'`. E2E tests fail on any CSP violation, in both dev and production builds.
3. **Internal error details shown to users (low).** Transfers and auth returned any exception's message (for example a raw "fetch failed" or an Appwrite database error). Now only Appwrite's and Dwolla's own user-facing messages (`DwollaRequestError`) are shown; everything else gets a generic message.
4. **Transfer sent but not recorded.** The user now gets "The transfer was sent… Please don't send it again." instead of an error that invites a retry, and the Dwolla transfer URL is logged.
5. **Unfinished bank records crashed the dashboard.** Bank documents without a token or funding source are skipped, and can't send or receive.
6. Removed the unused hard-coded Plaid tokens and IDs from `constants/index.ts`.

### Tests
- 133 unit/component tests (19 new: limits, lockout across IPs, reset after success, outages don't lock, safe errors, unfinished banks).
- 21 e2e tests, passing against both `next dev` and `next start`, including CSP violations and response headers.

## Phase 9: Documentation (2026-11-02)

- **README.md** rewritten. It replaces the create-next-app placeholder and covers:
  - features, and a sandbox-only disclaimer;
  - architecture: a diagram, the layers, the request and transfer flows, and the Appwrite data model;
  - step-by-step setup for Appwrite, Plaid (including enabling the Dwolla integration), Dwolla, the encryption key and Sentry;
  - scripts and testing;
  - a security summary, known limitations and the project layout.

  It credits the JavaScript Mastery tutorial the project started from.
- **.env.example** now lists only variables the code reads. Removed: `NEXT_PUBLIC_SITE_URL`, `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES`, `DWOLLA_BASE_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`; the Sentry org and project are set in `next.config.ts`. Added `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` for the e2e tests. Your own `.env` / `.env.local` were not changed.
- **Verified:**
  - A fresh clone with only `.env.example` copied to `.env.local` runs `npm ci`, `npm run typecheck`, `npm test` (133 passed) and `npm run build`.
  - Every README anchor and referenced file exists, and the UI labels the README mentions (Connect bank, shareable ID on My Banks) match the app.
- **Not verified:** the Mermaid diagram renders only on GitHub, and isn't checked until the branch is pushed. The Plaid bank-linking steps can't be followed end to end until the Dwolla integration is enabled (remaining issue 1).

## Phase 10: Deployment (in progress)

**Plan (approved 2026-11-02):** Vercel Hobby, with the existing Appwrite Cloud project as the database, and the Plaid and Dwolla sandboxes. Expected cost: $0. No custom domain.

### Done
- **License:** merged GitHub's initial commit on `master` (the MIT `LICENSE`) into `develop`, so `develop` can merge into `master` cleanly. The README keeps the `develop` version and has a License section.
- **Testing a deployed site:** `E2E_BASE_URL` points the Playwright tests at a deployed site.
- **Sign-up notice:** "This is a demo. Use made-up details…", so public visitors don't enter real identity data.
- **Checks:** 133 unit tests, 21 e2e tests, type check, lint and the production build all pass.

### GitGuardian scan on the pull request
GitGuardian flagged 5 "Plaid access tokens". None is a live credential; Plaid returns `INVALID_ACCESS_TOKEN` for all of them:
- **4** are the tutorial's hard-coded sandbox tokens in old commits (`f9018b2`, `4e88798`). They were already public on GitHub before this work, and were removed from the code in Phase 8.
- **1** was a made-up test fixture in `tests/unit/crypto.test.ts`. It now uses a value that isn't shaped like a token.

The check scans every commit in the PR, so it keeps failing on the old commits. Rewriting history would remove them, but that is disruptive and not needed for invalid tokens. Instead, mark the incidents as resolved (false positive / revoked) in the GitGuardian dashboard.

### Remaining (in order)
1. Resolve the GitGuardian incidents, then merge the pull request from `develop` into `master` (yours to review and merge).
2. Import the repo on Vercel. Add the Production environment variables from `.env.example`, using the same values as `.env.local`, including the same `ENCRYPTION_KEY`. Leave out `TEST_USER_*`.
3. Enable Plaid's Dwolla integration (remaining issue 1). Until then the live site can't link banks or make transfers.
4. Run `E2E_BASE_URL=<live URL> npm run test:e2e`, then add the live link to the README.

## Remaining issues

1. **Bank linking blocked by Plaid configuration.** Plaid returns `INVALID_PRODUCT`: the API keys in `.env.local` are not enabled for the Dwolla integration. Enable it at https://dashboard.plaid.com/developers/integrations. Until then no bank can be linked, so transfers cannot be tested. Re-checked after the integration was reportedly enabled: a direct sandbox API call with client ID `…e109` (the only one in `.env` and `.env.local`) still returns `INVALID_PRODUCT`.
2. **Appwrite `ssn` attribute** is now optional (changed by you in the console), and new users are created without it. The original account's SSN value is still stored. Delete the attribute to remove it. The backup in `.backups/` also contains that value; delete it when no longer needed.
3. **The original account's 2 bank documents are unfinished**: they have no access token and no Dwolla funding source (an interrupted link). They are now ignored instead of crashing the dashboard. They can be deleted in the Appwrite console, or left as they are.
4. If Dwolla accepts a transfer but writing the Appwrite transaction record fails, the user is now told not to resend it, and the Dwolla transfer URL is logged. The record still has to be added by hand. Transfers also have no idempotency key, so a request retried at the network level could send twice.
5. Every page view re-syncs all Plaid transactions with no stored cursor. Slow with many transactions.
6. `.env` contains `APPWRITE_SECRET`, which nothing reads (can be removed by hand).
7. Rate limits live in each server instance's memory. That is enough for one server; on a multi-instance host (several serverless instances) they should move to a shared store such as Redis.
8. `npm audit`: 5 moderate advisories in `glob`/`minimatch`, pulled in only by Sentry's build-time plugin. They are not reachable from the running app; the suggested fix is a breaking Sentry downgrade, so they are accepted for now.
9. **Appwrite session length** is a project setting (default 1 year). For a banking app, shorten it in the Appwrite console under Auth → Security → Session length (for example 1 day).

## Tests performed

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint .` | ✅ 0 errors, 0 warnings (was 16 warnings) |
| `next build` (production) | ✅ passes; proxy registered |
| Server actions exposed in build | ✅ exactly the 6 intended |
| Signed-out `/` and `/transaction-history?id=…` | ✅ 307 to `/sign-in` |
| Forged session cookie on `/` | ✅ rejected by the server check, redirected to sign-in, no redirect loop |
| Removed `/api/sentry-example-api` | ✅ 404 |
| Sign-in with wrong credentials (browser) | ✅ shows "Invalid credentials" alert |
| Sign-up (browser, sandbox test account) | ✅ account and Dwolla customer created; user document has no SSN |
| Sign-in with valid credentials | ✅ lands on dashboard |
| Logout | ✅ redirects to `/sign-in`; next request to `/` redirects (cookie cleared) |
| Dashboard, My Banks, Payment Transfer, Transaction History with no banks | ✅ render with empty states, no error boundary |
| Page payload for signed-in user | ✅ no address, date of birth, Dwolla IDs, tokens or funding-source URLs |
| Other user's bank IDs via `?id=` on `/` and `/transaction-history` | ✅ not shown; history shows "No bank connected yet" |
| Plaid Link failure | ✅ readable message shown; server log has one line and no secret |
| Bank linking success, transfers | ❌ blocked by remaining issue 1 |

## Deployment status

Not deployed. Proposed: Vercel Hobby (free) + existing Appwrite Cloud project, with Plaid and Dwolla in sandbox.
