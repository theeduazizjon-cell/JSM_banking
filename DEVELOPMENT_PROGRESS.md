# Development Progress

Working log for turning jsm_banking into a production-ready portfolio app.
Backup of the pre-work state: git tag `backup/pre-phase3`.

## Status by phase

| Phase | Status |
|---|---|
| 1. Audit | ✅ Done (2026-11-01) |
| 2. Tools and agents | ✅ Built-in tools are enough; only dev test packages needed (approved, not yet installed) |
| 3. Error fixing and security | ✅ Done; signed-in flows tested except bank linking and transfers (blocked by a Plaid dashboard setting) |
| 4. UI/UX | 🟡 First pass done (theme tokens, accessibility, responsive fixes, empty states); screens with real bank data not yet reviewed |
| 5. Banking features | ⏳ Not started |
| 6. Architecture | 🟡 Partly done (data access layer introduced in Phase 3) |
| 7. Testing | ⏳ Not started (no automated tests yet) |
| 8. Security audit | 🟡 Main issues fixed in Phase 3; full review pending |
| 9. Documentation | ⏳ Not started (README still the create-next-app default) |
| 10. Deployment | ⏳ Not started |

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

## Remaining issues

1. **Bank linking blocked by Plaid configuration.** Plaid returns `INVALID_PRODUCT`: the API keys in `.env.local` are not enabled for the Dwolla integration. Enable it at https://dashboard.plaid.com/developers/integrations. Until then no bank can be linked, so transfers cannot be tested. Re-checked after the integration was reportedly enabled: a direct sandbox API call with client ID `…e109` (the only one in `.env` and `.env.local`) still returns `INVALID_PRODUCT`.
2. **Appwrite `ssn` attribute** is now optional (changed by you in the console), and new users are created without it. The original account's SSN value is still stored. Delete the attribute to remove it. The backup in `.backups/` also contains that value; delete it when no longer needed.
3. Existing Plaid tokens in the 2 bank documents are still plaintext (still readable; new links are encrypted). A one-off migration script can re-encrypt them.
4. If Dwolla accepts a transfer but writing the Appwrite transaction record fails, the transfer is not shown in history. Needs reconciliation (e.g. look up the Dwolla transfer by URL).
5. Every page view re-syncs all Plaid transactions with no stored cursor. Slow with many transactions.
6. `.env` contains `APPWRITE_SECRET`, which nothing reads (can be removed by hand).
7. No automated tests yet.
8. Unverified: whether the original account's 2 banks still load. If `.env.local`'s Plaid keys differ from the ones used to link them, their tokens will be rejected and the error screen will show.

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
