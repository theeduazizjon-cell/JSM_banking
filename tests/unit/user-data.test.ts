import { describe, expect, it, vi } from "vitest";

const account = { get: vi.fn() };
const database = { listDocuments: vi.fn() };
const createSessionClient = vi.fn();

vi.mock("@/lib/appwrite", () => ({
  createSessionClient,
  createAdminClient: async () => ({ database }),
}));

const { getCurrentUser, toPublicUser } = await import("@/lib/data/user");

const userDoc = {
  $id: "doc-1",
  userId: "login-1",
  email: "jane@example.com",
  firstName: "Jane",
  lastName: "Doe",
  address1: "123 Main St",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  dateOfBirth: "1990-01-15",
  dwollaCustomerId: "dwolla-1",
  dwollaCustomerUrl: "https://api-sandbox.dwolla.com/customers/dwolla-1",
};

describe("getCurrentUser", () => {
  it("returns null without a session", async () => {
    createSessionClient.mockRejectedValueOnce(new Error("No session"));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null when Appwrite rejects the session", async () => {
    createSessionClient.mockResolvedValueOnce({ account });
    account.get.mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { code: 401 }));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(database.listDocuments).not.toHaveBeenCalled();
  });

  it("returns null for a login without a profile document", async () => {
    createSessionClient.mockResolvedValueOnce({ account });
    account.get.mockResolvedValueOnce({ $id: "login-1" });
    database.listDocuments.mockResolvedValueOnce({ total: 0, documents: [] });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("looks the profile up by the session's own account ID", async () => {
    createSessionClient.mockResolvedValueOnce({ account });
    account.get.mockResolvedValueOnce({ $id: "login-1" });
    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [userDoc] });

    await expect(getCurrentUser()).resolves.toMatchObject({ $id: "doc-1", email: "jane@example.com" });
    expect(JSON.stringify(database.listDocuments.mock.calls[0][2])).toContain("login-1");
  });
});

describe("toPublicUser", () => {
  it("keeps only what the browser needs", () => {
    expect(toPublicUser(userDoc as User)).toEqual({
      $id: "doc-1",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    });
  });
});
