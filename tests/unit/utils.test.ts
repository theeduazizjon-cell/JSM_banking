import { describe, expect, it } from "vitest";

import {
  authFormSchema,
  changePasswordSchema,
  countTransactionCategories,
  extractCustomerIdFromUrl,
  formatAmount,
  fromShareableId,
  getTransactionStatus,
  toShareableId,
  transferFormSchema,
} from "@/lib/utils";

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe("shareable IDs", () => {
  it("round-trips a Plaid account ID", () => {
    const id = toShareableId("vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D");

    expect(fromShareableId(id)).toBe("vzeNDwK7KQIm4yEog683uElbp9GRLEFXGK98D");
  });

  it("tolerates surrounding whitespace from copy and paste", () => {
    expect(fromShareableId(`  ${toShareableId("abc123")}\n`)).toBe("abc123");
  });

  it("returns null for input that is not base64", () => {
    expect(fromShareableId("not base64!!")).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formats US dollars with cents", () => {
    expect(formatAmount(1234.5)).toBe("$1,234.50");
    expect(formatAmount(0)).toBe("$0.00");
  });
});

describe("getTransactionStatus", () => {
  it("shows pending transactions as processing", () => {
    expect(getTransactionStatus({ pending: true })).toBe("Processing");
    expect(getTransactionStatus({ pending: false })).toBe("Success");
  });
});

describe("countTransactionCategories", () => {
  it("counts categories, most common first", () => {
    const result = countTransactionCategories([
      { category: "Food" },
      { category: "Travel" },
      { category: "Food" },
    ] as Transaction[]);

    expect(result).toEqual([
      { name: "Food", count: 2, totalCount: 3 },
      { name: "Travel", count: 1, totalCount: 3 },
    ]);
  });

  it("returns an empty list for no transactions", () => {
    expect(countTransactionCategories([])).toEqual([]);
  });
});

describe("extractCustomerIdFromUrl", () => {
  it("takes the last path segment", () => {
    expect(extractCustomerIdFromUrl("https://api-sandbox.dwolla.com/customers/abc-123")).toBe("abc-123");
  });
});

describe("transferFormSchema", () => {
  const valid = {
    email: "friend@example.com",
    name: "Dinner",
    amount: "25.50",
    senderBank: "bank-doc-id",
    sharableId: toShareableId("receiver-account"),
  };

  it("accepts a valid transfer", () => {
    expect(transferFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["0", "Amount must be greater than zero"],
    ["-5", "Enter an amount like 25 or 25.50"],
    ["12.345", "Enter an amount like 25 or 25.50"],
    ["1e3", "Enter an amount like 25 or 25.50"],
    ["abc", "Enter an amount like 25 or 25.50"],
    ["5000.01", "Sandbox transfers are limited to $5,000"],
  ])("rejects the amount %s", (amount, message) => {
    expect(firstError(transferFormSchema.safeParse({ ...valid, amount }))).toBe(message);
  });

  it("accepts the $5,000 limit itself", () => {
    expect(transferFormSchema.safeParse({ ...valid, amount: "5000" }).success).toBe(true);
  });

  it("requires a sender bank, an email and a plausible shareable ID", () => {
    expect(firstError(transferFormSchema.safeParse({ ...valid, senderBank: "" }))).toBe("Please select a bank account");
    expect(firstError(transferFormSchema.safeParse({ ...valid, email: "nope" }))).toBe("Invalid email address");
    expect(firstError(transferFormSchema.safeParse({ ...valid, sharableId: "short" }))).toBe("Please enter a valid shareable ID");
  });
});

describe("changePasswordSchema", () => {
  const valid = { currentPassword: "old-password", newPassword: "new-password-1", confirmPassword: "new-password-1" };

  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true);
  });

  it("requires the current password", () => {
    expect(firstError(changePasswordSchema.safeParse({ ...valid, currentPassword: "" }))).toBe("Enter your current password");
  });

  it("requires at least 8 characters", () => {
    expect(firstError(changePasswordSchema.safeParse({ ...valid, newPassword: "short", confirmPassword: "short" })))
      .toBe("Use at least 8 characters");
  });

  it("requires the confirmation to match", () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: "something-else" });

    expect(result.error?.issues[0]).toMatchObject({ message: "Passwords don't match", path: ["confirmPassword"] });
  });

  it("rejects reusing the current password", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "same-password", newPassword: "same-password", confirmPassword: "same-password" });

    expect(result.error?.issues[0]).toMatchObject({ message: "The new password must be different", path: ["newPassword"] });
  });
});

describe("authFormSchema", () => {
  const signUp = {
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

  it("only needs an email and password to sign in", () => {
    expect(authFormSchema("sign-in").safeParse({ email: "jane@example.com", password: "password123" }).success).toBe(true);
  });

  it("rejects a short password", () => {
    expect(authFormSchema("sign-in").safeParse({ email: "jane@example.com", password: "short" }).success).toBe(false);
  });

  it("accepts a complete sign-up", () => {
    expect(authFormSchema("sign-up").safeParse(signUp).success).toBe(true);
  });

  it("requires the sign-up details", () => {
    expect(authFormSchema("sign-up").safeParse({ ...signUp, address1: undefined }).success).toBe(false);
  });

  it.each(["1990-02-30", "15/01/1990", "2999-01-01"])("rejects the date of birth %s", (dateOfBirth) => {
    expect(authFormSchema("sign-up").safeParse({ ...signUp, dateOfBirth }).success).toBe(false);
  });
});
