import { describe, expect, it } from "vitest";

import {
  filterTransactions,
  getCategories,
  hasActiveFilters,
  parseTransactionFilters,
  summarizeCashFlow,
} from "@/lib/transactions";

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "x",
  $id: "x",
  name: "Transaction",
  paymentChannel: "online",
  type: "debit",
  accountId: "acc",
  amount: 10,
  pending: false,
  category: "Other",
  date: "2026-11-01",
  image: "",
  $createdAt: "",
  channel: "online",
  senderBankId: "",
  receiverBankId: "",
  ...overrides,
});

const transactions = [
  tx({ id: "1", name: "Payroll", amount: 3200, type: "credit", category: "Income", date: "2026-11-01" }),
  tx({ id: "2", name: "Grocery Market", amount: 84.17, category: "Food and Drink", date: "2026-10-28" }),
  tx({ id: "3", name: "Coffee", amount: 4.5, category: "Food and Drink", date: "2026-11-02", pending: true }),
  // Transfers recorded in Appwrite carry a full ISO timestamp
  tx({ id: "4", name: "Transfer", amount: 500, category: "Transfer", date: "2026-09-15T10:00:00.000Z" }),
  tx({ id: "5", name: "Old rent", amount: 1000, category: "Rent", date: "2025-01-01" }),
];

const idsFor = (searchParams: Record<string, string | string[] | undefined>) =>
  filterTransactions(transactions, parseTransactionFilters(searchParams)).map((t) => t.id);

describe("parseTransactionFilters", () => {
  it("defaults to no filters", () => {
    expect(parseTransactionFilters({})).toEqual({ query: "", type: "all", category: "", from: "", to: "" });
  });

  it("ignores an unknown type and malformed dates", () => {
    const filters = parseTransactionFilters({ type: "evil", from: "yesterday", to: "2026-13" });

    expect(filters.type).toBe("all");
    expect(filters.from).toBe("");
    expect(filters.to).toBe("");
  });

  it("trims and caps the search text", () => {
    expect(parseTransactionFilters({ q: `  ${"a".repeat(150)}  ` }).query).toHaveLength(100);
  });

  it("uses the first value when a parameter repeats", () => {
    expect(parseTransactionFilters({ type: ["credit", "debit"] }).type).toBe("credit");
  });
});

describe("hasActiveFilters", () => {
  it("is false with no filters and true with any filter", () => {
    expect(hasActiveFilters(parseTransactionFilters({}))).toBe(false);
    expect(hasActiveFilters(parseTransactionFilters({ type: "debit" }))).toBe(true);
    expect(hasActiveFilters(parseTransactionFilters({ from: "2026-01-01" }))).toBe(true);
  });
});

describe("filterTransactions", () => {
  it("returns everything without filters", () => {
    expect(idsFor({})).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("searches names case-insensitively", () => {
    expect(idsFor({ q: "GROCERY" })).toEqual(["2"]);
  });

  it("searches categories too", () => {
    expect(idsFor({ q: "food" })).toEqual(["2", "3"]);
  });

  it("filters by money in or out", () => {
    expect(idsFor({ type: "credit" })).toEqual(["1"]);
    expect(idsFor({ type: "debit", category: "Food and Drink" })).toEqual(["2", "3"]);
  });

  it("filters by an inclusive date range, including ISO timestamps", () => {
    expect(idsFor({ from: "2026-09-01", to: "2026-10-31" })).toEqual(["2", "4"]);
    expect(idsFor({ from: "2026-11-02", to: "2026-11-02" })).toEqual(["3"]);
  });

  it("ignores filters it could not parse", () => {
    expect(idsFor({ from: "yesterday", type: "evil" })).toEqual(["1", "2", "3", "4", "5"]);
  });
});

describe("getCategories", () => {
  it("returns unique categories in alphabetical order", () => {
    expect(getCategories(transactions)).toEqual(["Food and Drink", "Income", "Rent", "Transfer"]);
  });
});

describe("summarizeCashFlow", () => {
  const now = new Date("2026-11-15T00:00:00Z");

  it("returns one bucket per month, oldest first", () => {
    const months = summarizeCashFlow(transactions, 3, now);

    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(months.map((m) => m.label)).toEqual(["Sep", "Oct", "Nov"]);
  });

  it("totals settled income and expenses and skips pending ones", () => {
    const [sep, oct, nov] = summarizeCashFlow(transactions, 3, now);

    expect(nov).toMatchObject({ income: 3200, expenses: 0 });
    expect(oct).toMatchObject({ income: 0, expenses: 84.17 });
    expect(sep).toMatchObject({ income: 0, expenses: 500 });
  });

  it("leaves out transactions older than the window", () => {
    const total = summarizeCashFlow(transactions, 6, now).reduce((sum, m) => sum + m.expenses, 0);

    expect(total).toBe(584.17);
  });

  it("rounds totals to cents", () => {
    const [month] = summarizeCashFlow(
      [tx({ amount: 0.1, date: "2026-11-01" }), tx({ amount: 0.2, date: "2026-11-02" })],
      1,
      now,
    );

    expect(month.expenses).toBe(0.3);
  });

  it("crosses year boundaries", () => {
    const months = summarizeCashFlow([], 3, new Date("2026-01-10T00:00:00Z"));

    expect(months.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});
