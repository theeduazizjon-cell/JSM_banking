import { describe, expect, it, vi } from "vitest";

const SECRET = "plaid-secret-value-that-must-never-leak";

// An error shaped like the Axios errors Plaid's SDK throws: the request
// config, headers included, travels with it.
const axiosError = (data?: object) =>
  Object.assign(new Error("Request failed with status code 400"), {
    config: { headers: { "PLAID-SECRET": SECRET } },
    response: { status: 400, data },
  });

const accountsGet = vi.fn();

vi.mock("plaid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("plaid")>()),
  PlaidApi: class {
    basePath = "https://sandbox.plaid.com";
    accountsGet = accountsGet;
  },
}));

const { getPlaidErrorMessage, plaidClient, PlaidRequestError } = await import("@/lib/plaid");

describe("plaidClient", () => {
  it("passes successful responses through", async () => {
    accountsGet.mockResolvedValueOnce({ data: { accounts: [] } });

    await expect(plaidClient.accountsGet({ access_token: "token" })).resolves.toEqual({ data: { accounts: [] } });
    expect(accountsGet).toHaveBeenCalledWith({ access_token: "token" });
  });

  it("passes non-function properties through", () => {
    expect((plaidClient as unknown as { basePath: string }).basePath).toBe("https://sandbox.plaid.com");
  });

  it("replaces Plaid API errors with a safe error that has no request details", async () => {
    accountsGet.mockRejectedValueOnce(axiosError({
      error_code: "INVALID_PRODUCT",
      error_message: "client is not authorized to access the following products",
      display_message: null,
    }));

    const error = await plaidClient.accountsGet({ access_token: "token" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlaidRequestError);
    expect(error).toMatchObject({ code: "INVALID_PRODUCT", displayMessage: null });
    expect(error).not.toHaveProperty("config");
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(SECRET);
  });

  it("also strips network errors that have no Plaid error body", async () => {
    accountsGet.mockRejectedValueOnce(axiosError());

    const error = await plaidClient.accountsGet({ access_token: "token" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Plaid request failed: Request failed with status code 400");
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(SECRET);
  });
});

describe("getPlaidErrorMessage", () => {
  it("prefers Plaid's message for end users", () => {
    const error = new PlaidRequestError("ITEM_LOGIN_REQUIRED", "login required", "Please sign in to your bank again.");

    expect(getPlaidErrorMessage(error, "Fallback")).toBe("Please sign in to your bank again.");
  });

  it("falls back to the given message with the error code", () => {
    expect(getPlaidErrorMessage(new PlaidRequestError("INVALID_PRODUCT", "x", null), "Could not connect."))
      .toBe("Could not connect. (Plaid error INVALID_PRODUCT)");
  });

  it("never shows the details of unknown errors", () => {
    expect(getPlaidErrorMessage(new Error(`boom ${SECRET}`), "Could not connect.")).toBe("Could not connect.");
  });
});
