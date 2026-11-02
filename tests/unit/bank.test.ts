import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = { listDocuments: vi.fn(), createDocument: vi.fn() };
const plaid = {
  accountsGet: vi.fn(),
  institutionsGetById: vi.fn(),
  transactionsSync: vi.fn(),
};

vi.mock("@/lib/appwrite", () => ({ createAdminClient: async () => ({ database }) }));
vi.mock("@/lib/plaid", () => ({ plaidClient: plaid }));

const { encryptSecret } = await import("@/lib/crypto");
const { createBankAccount, getAccount, getBankByAccountId, getBankOwnerId, getBanks, getOwnedBank, getTransactions } = await import("@/lib/data/bank");

const bankDoc = (overrides: Partial<Bank> = {}): Bank => ({
  $id: "bank-1",
  accountId: "plaid-account-1",
  bankId: "item-1",
  accessToken: encryptSecret("access-sandbox-token"),
  fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/fs-1",
  userId: "user-1",
  shareableId: "c2hhcmU=",
  ...overrides,
});

const plaidTransaction = (overrides: object) => ({
  transaction_id: "t",
  account_id: "plaid-account-1",
  name: "Coffee",
  amount: 4.5,
  payment_channel: "in store",
  pending: false,
  category: null,
  personal_finance_category: null,
  date: "2026-10-30",
  logo_url: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
});

describe("getBankOwnerId", () => {
  it("reads the owner whether Appwrite returns an ID or the related document", () => {
    expect(getBankOwnerId(bankDoc({ userId: "user-1" }))).toBe("user-1");
    expect(getBankOwnerId(bankDoc({ userId: { $id: "user-1" } }))).toBe("user-1");
  });
});

describe("createBankAccount", () => {
  it("encrypts the Plaid access token before saving it", async () => {
    database.createDocument.mockResolvedValueOnce({ $id: "new-bank" });

    await createBankAccount({
      userId: "user-1",
      bankId: "item-1",
      accountId: "plaid-account-1",
      accessToken: "access-sandbox-token",
      fundingSourceUrl: "https://api-sandbox.dwolla.com/funding-sources/fs-1",
      shareableId: "c2hhcmU=",
    });

    const saved = database.createDocument.mock.calls[0][3];
    expect(saved.accessToken).toMatch(/^enc:v1:/);
    expect(JSON.stringify(saved)).not.toContain("access-sandbox-token");
  });
});

describe("getOwnedBank", () => {
  it("returns the bank with its token decrypted for its owner", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [bankDoc({ userId: { $id: "user-1" } })] });

    const bank = await getOwnedBank({ documentId: "bank-1", userId: "user-1" });

    expect(bank?.$id).toBe("bank-1");
    expect(bank?.accessToken).toBe("access-sandbox-token");
  });

  it("refuses another user's bank", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [bankDoc({ userId: "someone-else" })] });

    await expect(getOwnedBank({ documentId: "bank-1", userId: "user-1" })).resolves.toBeNull();
  });

  it("returns null for a bank that does not exist", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 0, documents: [] });

    await expect(getOwnedBank({ documentId: "missing", userId: "user-1" })).resolves.toBeNull();
  });
});

describe("unfinished bank records", () => {
  // An interrupted Plaid link can leave a bank document with no token or
  // funding source; these must not crash pages or receive transfers.
  const unfinished = () => bankDoc({ $id: "bank-broken", accessToken: null as unknown as string, fundingSourceUrl: "" });

  it("are left out of a user's banks", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 2, documents: [unfinished(), bankDoc()] });

    await expect(getBanks({ userId: "user-1" })).resolves.toEqual([expect.objectContaining({ $id: "bank-1" })]);
  });

  it("can't be used to send or receive", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [unfinished()] });
    await expect(getOwnedBank({ documentId: "bank-broken", userId: "user-1" })).resolves.toBeNull();

    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [unfinished()] });
    await expect(getBankByAccountId({ accountId: "plaid-account-1" })).resolves.toBeNull();
  });
});

describe("getAccount", () => {
  it("does not call Plaid for a bank the user does not own", async () => {
    database.listDocuments.mockResolvedValueOnce({ total: 1, documents: [bankDoc({ userId: "someone-else" })] });

    await expect(getAccount({ appwriteItemId: "bank-1", userId: "user-1" })).resolves.toBeNull();
    expect(plaid.accountsGet).not.toHaveBeenCalled();
    expect(plaid.transactionsSync).not.toHaveBeenCalled();
  });

  it("merges Plaid transactions with recorded transfers, newest first", async () => {
    database.listDocuments
      .mockResolvedValueOnce({ total: 1, documents: [bankDoc()] })
      // transfers sent from this bank, then transfers received by it
      .mockResolvedValueOnce({ total: 1, documents: [{ $id: "tr-out", name: "Rent", amount: "500.00", channel: "online", category: "Transfer", senderBankId: "bank-1", receiverBankId: "bank-2", $createdAt: "2026-11-01T09:00:00.000Z" }] })
      .mockResolvedValueOnce({ total: 1, documents: [{ $id: "tr-in", name: "Refund", amount: "20.00", channel: "online", category: "Transfer", senderBankId: "bank-2", receiverBankId: "bank-1", $createdAt: "2026-10-01T09:00:00.000Z" }] });

    plaid.accountsGet.mockResolvedValueOnce({
      data: {
        item: { institution_id: "ins_1" },
        accounts: [
          { account_id: "other-account", name: "Savings", balances: { available: 1, current: 1 }, type: "depository" },
          { account_id: "plaid-account-1", name: "Checking", official_name: null, mask: "0000", balances: { available: 100, current: 110 }, type: "depository", subtype: "checking" },
        ],
      },
    });
    plaid.institutionsGetById.mockResolvedValueOnce({ data: { institution: { institution_id: "ins_1" } } });
    plaid.transactionsSync.mockResolvedValueOnce({
      data: { added: [plaidTransaction({ transaction_id: "p1", date: "2026-10-15" })], has_more: false, next_cursor: "c1" },
    });

    const result = await getAccount({ appwriteItemId: "bank-1", userId: "user-1" });

    // The linked account is picked by ID, not just the first one in the item
    expect(result?.data).toMatchObject({ id: "plaid-account-1", name: "Checking", currentBalance: 110, appwriteItemId: "bank-1" });
    expect(plaid.accountsGet).toHaveBeenCalledWith({ access_token: "access-sandbox-token" });
    expect(result?.transactions.map((t) => [t.id, t.type, t.amount])).toEqual([
      ["tr-out", "debit", 500],
      ["p1", "debit", 4.5],
      ["tr-in", "credit", 20],
    ]);
  });
});

describe("getTransactions", () => {
  it("follows every page, keeps only the linked account and normalises amounts", async () => {
    plaid.transactionsSync
      .mockResolvedValueOnce({
        data: {
          added: [
            plaidTransaction({ transaction_id: "out", amount: 12.34, category: ["Food and Drink", "Coffee"] }),
            plaidTransaction({ transaction_id: "elsewhere", account_id: "other-account" }),
          ],
          has_more: true,
          next_cursor: "page-2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          added: [
            plaidTransaction({ transaction_id: "in", amount: -2500, personal_finance_category: { primary: "TRANSFER_IN" } }),
            plaidTransaction({ transaction_id: "food", personal_finance_category: { primary: "FOOD_AND_DRINK" } }),
            plaidTransaction({ transaction_id: "unknown" }),
          ],
          has_more: false,
          next_cursor: "page-3",
        },
      });

    const transactions = await getTransactions({ accessToken: "token", accountId: "plaid-account-1" });

    expect(plaid.transactionsSync).toHaveBeenNthCalledWith(2, { access_token: "token", cursor: "page-2" });
    expect(transactions.map((t) => [t.id, t.type, t.amount, t.category])).toEqual([
      ["out", "debit", 12.34, "Food and Drink"],
      ["in", "credit", 2500, "Transfer In"],
      ["food", "debit", 4.5, "Food and Drink"],
      ["unknown", "debit", 4.5, "Other"],
    ]);
  });
});
