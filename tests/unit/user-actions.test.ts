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
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/appwrite", () => ({
  SESSION_COOKIE: "appwrite-session",
  createAdminClient: async () => ({ account: mocks.account, database: mocks.database, user: mocks.users }),
  createSessionClient: mocks.createSessionClient,
}));
vi.mock("@/lib/dwolla", () => ({ createDwollaCustomer: mocks.createDwollaCustomer, addFundingSource: vi.fn() }));
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

beforeEach(() => {
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
    mocks.account.createEmailPasswordSession.mockRejectedValue(new Error("Invalid credentials. Please check the email and password."));

    await expect(signIn({ email: "jane@example.com", password: "password123" }))
      .resolves.toEqual({ ok: false, error: "Invalid credentials. Please check the email and password." });
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  beforeEach(() => {
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
    mocks.createDwollaCustomer.mockRejectedValue(new Error("Dwolla rejected these details: Invalid postal code."));

    await expect(signUp(signUpInput)).resolves.toEqual({ ok: false, error: "Dwolla rejected these details: Invalid postal code." });
    expect(mocks.users.delete).toHaveBeenCalledWith("login-1");
    expect(mocks.database.createDocument).not.toHaveBeenCalled();
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it("validates before creating anything", async () => {
    const result = await signUp({ ...signUpInput, dateOfBirth: "2999-01-01" });

    expect(result).toEqual({ ok: false, error: "Enter a real date in the past" });
    expect(mocks.account.create).not.toHaveBeenCalled();
  });

  it("explains a missing Appwrite configuration", async () => {
    vi.stubEnv("NEXT_APPWRITE_KEY", "");
    mocks.account.create.mockRejectedValue(new Error("Project not found"));

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

  it("reports an expired session", async () => {
    mocks.createSessionClient.mockRejectedValue(new Error("No session"));

    await expect(changePassword(input)).resolves.toEqual({ ok: false, error: "Your session has expired. Please sign in again." });
  });

  it("validates before contacting Appwrite", async () => {
    await expect(changePassword({ ...input, confirmPassword: "different" })).resolves.toEqual({ ok: false, error: "Passwords don't match" });
    expect(mocks.createSessionClient).not.toHaveBeenCalled();
  });
});
