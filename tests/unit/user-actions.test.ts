import { AppwriteException } from "node-appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), delete: vi.fn() },
  account: { create: vi.fn(), createEmailPasswordSession: vi.fn(), updatePassword: vi.fn(), deleteSession: vi.fn() },
  database: { createDocument: vi.fn() },
  users: { delete: vi.fn() },
  createSessionClient: vi.fn(),
  createDwollaCustomer: vi.fn(),
  getCurrentUser: vi.fn(),
  linkTokenCreate: vi.fn(),
  requestHeaders: new Headers(),
  DwollaRequestError: class DwollaRequestError extends Error {},
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore, headers: async () => mocks.requestHeaders }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/appwrite", () => ({
  SESSION_COOKIE: "appwrite-session",
  createAdminClient: async () => ({ account: mocks.account, database: mocks.database, user: mocks.users }),
  createSessionClient: mocks.createSessionClient,
}));
vi.mock("@/lib/dwolla", () => ({
  createDwollaCustomer: mocks.createDwollaCustomer,
  addFundingSource: vi.fn(),
  DwollaRequestError: mocks.DwollaRequestError,
}));
vi.mock("@/lib/plaid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plaid")>()),
  plaidClient: { linkTokenCreate: mocks.linkTokenCreate },
}));
vi.mock("@/lib/data/bank", () => ({ createBankAccount: vi.fn() }));
vi.mock("@/lib/data/user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/user")>()),
  getCurrentUser: mocks.getCurrentUser,
}));

const { changePassword, createLinkToken, exchangePublicToken, logoutAccount, signIn, signUp } = await import("@/lib/actions/user.actions");

const wrongPassword = () => new AppwriteException("Invalid credentials. Please check the email and password.", 401, "user_invalid_credentials");

const signUpInput: SignUpParams = {
  firstName: "Jane",
  lastName: "Doe",
  address1: "123 Main St",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  dateOfBirth: "1990-01-15",
  ssn: "1234",
  email: "jane@example.com",
  password: "password123",
};

// Each test starts in a fresh rate-limit window, from its own IP
let clock = Date.parse("2026-01-01T00:00:00Z");
let ipCounter = 0;

const fromIp = (ip: string) => mocks.requestHeaders.set("x-forwarded-for", `${ip}, 10.0.0.1`);

beforeEach(() => {
  clock += 2 * 60 * 60 * 1000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  fromIp(`203.0.113.${++ipCounter}`);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT", "project");
  vi.stubEnv("NEXT_APPWRITE_KEY", "key");
  mocks.account.createEmailPasswordSession.mockResolvedValue({ secret: "session-secret" });
});

describe("signIn", () => {
  it("sets an httpOnly, strict session cookie", async () => {
    await expect(signIn({ email: "jane@example.com", password: "password123" })).resolves.toEqual({ ok: true });

    expect(mocks.cookieStore.set).toHaveBeenCalledWith("appwrite-session", "session-secret", {
      path: "/", httpOnly: true, sameSite: "strict", secure: true,
    });
  });

  it("validates before contacting Appwrite", async () => {
    const result = await signIn({ email: "not-an-email", password: "x" });

    expect(result.ok).toBe(false);
    expect(mocks.account.createEmailPasswordSession).not.toHaveBeenCalled();
  });

  it("reports wrong credentials without setting a cookie", async () => {
    mocks.account.createEmailPasswordSession.mockRejectedValue(wrongPassword());

    await expect(signIn({ email: "jane@example.com", password: "password123" }))
      .resolves.toEqual({ ok: false, error: "Invalid credentials. Please check the email and password." });
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it("hides unexpected errors and doesn't count outages towards the lockout", async () => {
    mocks.account.createEmailPasswordSession.mockRejectedValue(new TypeError("fetch failed"));

    for (let i = 0; i < 6; i++) {
      await expect(signIn({ email: "jane@example.com", password: "password123" }))
        .resolves.toEqual({ ok: false, error: "Something went wrong. Please try again." });
    }

    mocks.account.createEmailPasswordSession.mockResolvedValue({ secret: "session-secret" });
    await expect(signIn({ email: "jane@example.com", password: "password123" })).resolves.toEqual({ ok: true });
  });

  it("locks an email after 5 failed attempts, even from different IPs", async () => {
    mocks.account.createEmailPasswordSession.mockRejectedValue(wrongPassword());

    for (let i = 0; i < 5; i++) {
      fromIp(`198.51.100.${i}`);
      await signIn({ email: "victim@example.com", password: "guess-number-" + i });
    }

    fromIp("198.51.100.99");
    mocks.account.createEmailPasswordSession.mockResolvedValue({ secret: "session-secret" });
    const result = await signIn({ email: "VICTIM@example.com", password: "the-real-password" });

    expect(result).toEqual({ ok: false, error: "Too many attempts. Please try again in 15 minute(s)." });
    expect(mocks.account.createEmailPasswordSession).toHaveBeenCalledTimes(5);

    // Other accounts can still sign in
    await expect(signIn({ email: "someone@example.com", password: "password123" })).resolves.toEqual({ ok: true });

    vi.setSystemTime(clock + 16 * 60 * 1000);
    await expect(signIn({ email: "victim@example.com", password: "the-real-password" })).resolves.toEqual({ ok: true });
  });

  it("forgets earlier failures after a successful sign-in", async () => {
    for (let i = 0; i < 4; i++) mocks.account.createEmailPasswordSession.mockRejectedValueOnce(wrongPassword());
    for (let i = 0; i < 4; i++) await signIn({ email: "jane@example.com", password: "wrong-password" });
    await expect(signIn({ email: "jane@example.com", password: "password123" })).resolves.toEqual({ ok: true });

    mocks.account.createEmailPasswordSession.mockRejectedValue(wrongPassword());
    for (let i = 0; i < 4; i++) await signIn({ email: "jane@example.com", password: "wrong-password" });

    mocks.account.createEmailPasswordSession.mockResolvedValue({ secret: "session-secret" });
    await expect(signIn({ email: "jane@example.com", password: "password123" })).resolves.toEqual({ ok: true });
  });

  it("limits one IP to 30 attempts across emails", async () => {
    mocks.account.createEmailPasswordSession.mockRejectedValue(wrongPassword());

    for (let i = 0; i < 30; i++) await signIn({ email: `user${i}@example.com`, password: "password123" });

    const result = await signIn({ email: "fresh@example.com", password: "password123" });
    expect(!result.ok && result.error).toMatch(/^Too many attempts/);
    expect(mocks.account.createEmailPasswordSession).toHaveBeenCalledTimes(30);
  });
});

describe("signUp", () => {
  beforeEach(() => {
    vi.stubEnv("DWOLLA_KEY", "key");
    vi.stubEnv("DWOLLA_SECRET", "secret");
    mocks.account.create.mockResolvedValue({ $id: "login-1" });
    mocks.createDwollaCustomer.mockResolvedValue("https://api-sandbox.dwolla.com/customers/dwolla-1");
    mocks.database.createDocument.mockImplementation(async (_db, _col, _id, data) => ({ $id: "doc-1", ...data }));
  });

  it("sends the SSN to Dwolla but never stores it or the password", async () => {
    const result = await signUp(signUpInput);

    expect(result).toEqual({ ok: true, data: { $id: "doc-1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" } });
    expect(mocks.createDwollaCustomer).toHaveBeenCalledWith(expect.objectContaining({ ssn: "1234", type: "personal" }));

    const stored = mocks.database.createDocument.mock.calls[0][3];
    expect(stored).not.toHaveProperty("ssn");
    expect(stored).not.toHaveProperty("password");
    expect(stored).toMatchObject({ userId: "login-1", dwollaCustomerId: "dwolla-1" });
  });

  it("removes the half-created login when Dwolla rejects the details", async () => {
    mocks.createDwollaCustomer.mockRejectedValue(new mocks.DwollaRequestError("Dwolla rejected these details: Invalid postal code."));

    await expect(signUp(signUpInput)).resolves.toEqual({ ok: false, error: "Dwolla rejected these details: Invalid postal code." });
    expect(mocks.users.delete).toHaveBeenCalledWith("login-1");
    expect(mocks.database.createDocument).not.toHaveBeenCalled();
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it("limits sign-ups to 5 an hour per IP", async () => {
    for (let i = 0; i < 5; i++) await signUp({ ...signUpInput, email: `new${i}@example.com` });

    const result = await signUp({ ...signUpInput, email: "new99@example.com" });
    expect(!result.ok && result.error).toMatch(/^Too many attempts/);
    expect(mocks.account.create).toHaveBeenCalledTimes(5);
  });

  it("validates before creating anything", async () => {
    const result = await signUp({ ...signUpInput, dateOfBirth: "2999-01-01" });

    expect(result).toEqual({ ok: false, error: "Enter a real date in the past" });
    expect(mocks.account.create).not.toHaveBeenCalled();
  });

  it("explains a missing Appwrite configuration", async () => {
    vi.stubEnv("NEXT_APPWRITE_KEY", "");
    mocks.account.create.mockRejectedValue(new AppwriteException("Project not found", 404));

    const result = await signUp(signUpInput);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Appwrite is not configured/);
  });
});

describe("logoutAccount", () => {
  it("clears the cookie even when the session has already expired", async () => {
    mocks.createSessionClient.mockRejectedValue(new Error("No session"));

    await expect(logoutAccount()).resolves.toEqual({ ok: true });
    expect(mocks.cookieStore.delete).toHaveBeenCalledWith("appwrite-session");
  });
});

describe("Plaid actions", () => {
  it("require a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(createLinkToken()).resolves.toEqual({ ok: false, error: "You need to be signed in to connect a bank." });
    await expect(exchangePublicToken({ publicToken: "public-sandbox-x" }))
      .resolves.toEqual({ ok: false, error: "You need to be signed in to connect a bank." });
    expect(mocks.linkTokenCreate).not.toHaveBeenCalled();
  });

  it("creates the link token for the session's own user", async () => {
    mocks.getCurrentUser.mockResolvedValue({ $id: "user-1", firstName: "Jane", lastName: "Doe" });
    mocks.linkTokenCreate.mockResolvedValue({ data: { link_token: "link-sandbox-1" } });

    await expect(createLinkToken()).resolves.toEqual({ ok: true, data: { linkToken: "link-sandbox-1" } });
    expect(mocks.linkTokenCreate).toHaveBeenCalledWith(expect.objectContaining({ user: { client_user_id: "user-1" } }));
  });
});

describe("changePassword", () => {
  const input = { currentPassword: "old-password", newPassword: "new-password-1", confirmPassword: "new-password-1" };

  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({ $id: "user-1" });
    mocks.createSessionClient.mockResolvedValue({ account: mocks.account });
  });

  it("asks Appwrite to verify the current password", async () => {
    await expect(changePassword(input)).resolves.toEqual({ ok: true });
    expect(mocks.account.updatePassword).toHaveBeenCalledWith({ password: "new-password-1", oldPassword: "old-password" });
  });

  it.each([
    [{ type: "user_invalid_credentials" }, "Your current password is incorrect."],
    [{ type: "user_password_recently_used" }, "Choose a password you have not used recently."],
    [{ type: "general_unknown" }, "Could not change your password. Please try again."],
  ])("maps the Appwrite error %j", async (error, message) => {
    mocks.account.updatePassword.mockRejectedValue(Object.assign(new Error("Appwrite error"), error));

    await expect(changePassword(input)).resolves.toEqual({ ok: false, error: message });
  });

  it("stops after 5 wrong current passwords", async () => {
    mocks.account.updatePassword.mockRejectedValue(Object.assign(new Error("Appwrite error"), { type: "user_invalid_credentials" }));

    for (let i = 0; i < 5; i++) await changePassword(input);

    const result = await changePassword(input);
    expect(!result.ok && result.error).toMatch(/^Too many attempts/);
    expect(mocks.account.updatePassword).toHaveBeenCalledTimes(5);
  });

  it("reports an expired session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(changePassword(input)).resolves.toEqual({ ok: false, error: "Your session has expired. Please sign in again." });

    mocks.getCurrentUser.mockResolvedValue({ $id: "user-1" });
    mocks.createSessionClient.mockRejectedValue(new Error("No session"));

    await expect(changePassword(input)).resolves.toEqual({ ok: false, error: "Your session has expired. Please sign in again." });
  });

  it("validates before contacting Appwrite", async () => {
    await expect(changePassword({ ...input, confirmPassword: "different" })).resolves.toEqual({ ok: false, error: "Passwords don't match" });
    expect(mocks.createSessionClient).not.toHaveBeenCalled();
  });
});
