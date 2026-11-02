// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TransactionsTable from "@/components/TransactionsTable";

afterEach(cleanup);

const tx = (overrides: Partial<Transaction>) =>
  ({ id: "1", name: "Coffee", amount: 4.5, type: "debit", pending: false, category: "Food and Drink", date: "2026-10-30", paymentChannel: "in store", ...overrides }) as Transaction;

describe("TransactionsTable", () => {
  it("shows the empty message in a single row", () => {
    render(<TransactionsTable transactions={[]} emptyMessage="No transactions match these filters." />);

    expect(screen.getByRole("cell", { name: "No transactions match these filters." }).getAttribute("colspan")).toBe("6");
  });

  it("signs outgoing amounts and shows the status", () => {
    render(<TransactionsTable transactions={[
      tx({ id: "out" }),
      tx({ id: "in", name: "Payroll", amount: 3200, type: "credit", category: "Income", pending: true }),
    ]} />);

    const [, outRow, inRow] = screen.getAllByRole("row");
    expect(within(outRow).getByText("-$4.50")).toBeTruthy();
    expect(within(outRow).getByText("Success")).toBeTruthy();
    expect(within(inRow).getByText("$3,200.00")).toBeTruthy();
    expect(within(inRow).getByText("Processing")).toBeTruthy();
  });
});
