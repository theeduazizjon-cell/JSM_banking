import { beforeEach, describe, expect, it, vi } from "vitest";

import { toShareableId } from "@/lib/utils";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOwnedBank: vi.fn(),
  getBankByAccountId: vi.fn(),
  createTransfer: vi.fn(),
  createTransaction: vi.fn(),
  revalidatePath: vi.fn(),
  DwollaRequestError: class DwollaRequestError extends Error {},
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/data/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/dwolla", () => ({ createTransfer: mocks.createTransfer, DwollaRequestError: mocks.DwollaRequestError }));
vi.mock("@/lib/data/transaction", () => ({ createTransaction: mocks.createTransaction }));
vi.mock("@/lib/data/bank", () => ({
  getOwnedBank: mocks.getOwnedBank,
  getBankByAccountId: mocks.getBankByAccountId,
  getBankOwnerId: (bank: Bank) => (typeof bank.userId === "string" ? bank.userId : bank.userId.$id),
}));

const { transferFunds } = await import("@/lib/actions/transfer.actions");

const senderBank = { $id: "bank-a", userId: "user-1", accountId: "acc-a", fundingSourceUrl: "https://dwolla/fs-a" };
const receiverBank = { $id: "bank-b", userId: { $id: "user-2" }, accountId: "acc-b", fundingSourceUrl: "https://dwolla/fs-b" };

const input: TransferFormValues = {
  email: "friend@example.com",
  name: "Dinner",
  amount: "25.5",
  senderBank: "bank-a",
  sharableId: toShareableId("acc-b"),
};

// Each test starts in a fresh rate-limit window
let clock = Date.parse("2026-01-01T00:00:00Z");

beforeEach(() => {
  clock += 2 * 60 * 60 * 1000;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(clock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getCurrentUser.mockResolvedValue({ $id: "user-1" });
  mocks.getOwnedBank.mockResolvedValue(senderBank);
  mocks.getBankByAccountId.mockResolvedValue(receiverBank);
  mocks.createTransfer.mockResolvedValue("https://dwolla/transfers/t-1");
  mocks.createTransaction.mockResolvedValue({ $id: "tx-1" });
});

const expectNothingMoved = () => {
  expect(mocks.createTransfer).not.toHaveBeenCalled();
  expect(mocks.createTransaction).not.toHaveBeenCalled();
};

describe("transferFunds", () => {
  it("moves money and records the transfer", async () => {
    await expect(transferFunds(input)).resolves.toEqual({ ok: true });

    expect(mocks.getOwnedBank).toHaveBeenCalledWith({ documentId: "bank-a", userId: "user-1" });
    expect(mocks.getBankByAccountId).toHaveBeenCalledWith({ accountId: "acc-b" });
    expect(mocks.createTransfer).toHaveBeenCalledWith({
      sourceFundingSourceUrl: "https://dwolla/fs-a",
      destinationFundingSourceUrl: "https://dwolla/fs-b",
      amount: "25.50",
    });
    expect(mocks.createTransaction).toHaveBeenCalledWith({
      name: "Dinner",
      amount: "25.50",
      senderId: "user-1",
      senderBankId: "bank-a",
      receiverId: "user-2",
      receiverBankId: "bank-b",
      email: "friend@example.com",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("names an untitled transfer", async () => {
    await transferFunds({ ...input, name: "" });

    expect(mocks.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ name: "Transfer" }));
  });

  it("requires a session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: "Your session has expired. Please sign in again." });
    expectNothingMoved();
  });

  it("validates input on the server, not only in the form", async () => {
    await expect(transferFunds({ ...input, amount: "-100" })).resolves.toEqual({ ok: false, error: "Enter an amount like 25 or 25.50" });
    await expect(transferFunds({ ...input, amount: "99999" })).resolves.toEqual({ ok: false, error: "Sandbox transfers are limited to $5,000" });
    expect(mocks.getOwnedBank).not.toHaveBeenCalled();
    expectNothingMoved();
  });

  it("refuses to send from a bank the user does not own", async () => {
    mocks.getOwnedBank.mockResolvedValue(null);

    await expect(transferFunds({ ...input, senderBank: "someone-elses-bank" }))
      .resolves.toEqual({ ok: false, error: "Select one of your own bank accounts to send from." });
    expectNothingMoved();
  });

  it("rejects an unknown or malformed shareable ID", async () => {
    mocks.getBankByAccountId.mockResolvedValue(null);
    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: "No account matches that shareable ID." });

    await expect(transferFunds({ ...input, sharableId: "%%%not-base64%%%" }))
      .resolves.toEqual({ ok: false, error: "No account matches that shareable ID." });
    expectNothingMoved();
  });

  it("rejects sending to the same account", async () => {
    mocks.getBankByAccountId.mockResolvedValue(senderBank);

    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: "Choose a different account to send to." });
    expectNothingMoved();
  });

  it("reports a Dwolla rejection and records nothing", async () => {
    mocks.createTransfer.mockRejectedValue(new mocks.DwollaRequestError("Dwolla rejected the transfer: Insufficient funds."));

    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: "Dwolla rejected the transfer: Insufficient funds." });
    expect(mocks.createTransaction).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("hides the details of unexpected errors", async () => {
    mocks.getBankByAccountId.mockRejectedValue(new Error("Appwrite: Database not found (project abc123)"));

    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: "The transfer could not be completed. Please try again." });
  });

  it("warns not to resend when the money moved but the record failed", async () => {
    mocks.createTransaction.mockRejectedValue(new Error("Appwrite timeout"));

    const result = await transferFunds(input);

    expect(result).toEqual({ ok: false, error: "The transfer was sent, but it could not be added to your history yet. Please don't send it again." });
    expect(console.error).toHaveBeenCalledWith("Transfer sent but not recorded:", "https://dwolla/transfers/t-1", "Appwrite timeout");
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("limits each user to 10 transfers an hour", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(transferFunds(input)).resolves.toEqual({ ok: true });
    }

    await expect(transferFunds(input)).resolves.toEqual({ ok: false, error: expect.stringMatching(/^Too many attempts/) });
    expect(mocks.createTransfer).toHaveBeenCalledTimes(10);

    // Another user is not affected
    mocks.getCurrentUser.mockResolvedValue({ $id: "user-3" });
    await expect(transferFunds(input)).resolves.toEqual({ ok: true });

    // The window resets after an hour
    mocks.getCurrentUser.mockResolvedValue({ $id: "user-1" });
    vi.setSystemTime(clock + 61 * 60 * 1000);
    await expect(transferFunds(input)).resolves.toEqual({ ok: true });
  });
});
