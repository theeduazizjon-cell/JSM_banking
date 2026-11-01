# Development Progress

Working log for turning jsm_banking into a production-ready portfolio app.
Backup of the pre-work state: git tag `backup/pre-phase3`.

## Status by phase

| Phase | Status |
|---|---|
| 1. Audit | ✅ Done (2026-11-01) |
| 2. Tools and agents | ✅ Built-in tools are enough; only dev test packages needed (approved, not yet installed) |
| 3. Error fixing and security | ✅ Code done; ⚠️ one Appwrite console step left (see Remaining) |
| 4. UI/UX | ⏳ Not started |
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

## Remaining issues

1. **Appwrite schema: `ssn` is still a required attribute.** Until it is changed, **new sign-ups fail** because the app no longer stores SSNs. Fix in the Appwrite console: Databases → users collection → Attributes → `ssn` → delete it (preferred) or untick Required. A backup of all collections is in `.backups/` (git-ignored, owner-only permissions; it contains the existing SSN value, so delete it when no longer needed). The automated change was blocked by the permission system.
2. Existing Plaid tokens in the 2 bank documents are still plaintext (still readable; new links are encrypted). A one-off migration script can re-encrypt them.
3. If Dwolla accepts a transfer but writing the Appwrite transaction record fails, the transfer is not shown in history. Needs reconciliation (e.g. look up the Dwolla transfer by URL).
4. Every page view re-syncs all Plaid transactions with no stored cursor. Slow with many transactions.
5. "Add Bank" in the right sidebar links to `/` instead of starting Plaid Link.
6. `.env` contains `APPWRITE_SECRET`, which nothing reads (can be removed by hand).
7. No automated tests yet.

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
| Signed-in flows (dashboard, linking, transfer) | ❌ Not tested: no test account available, and sign-up is blocked by remaining issue 1 |

## Deployment status

Not deployed. Proposed: Vercel Hobby (free) + existing Appwrite Cloud project, with Plaid and Dwolla in sandbox.
