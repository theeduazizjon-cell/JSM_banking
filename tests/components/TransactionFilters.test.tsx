// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TransactionFilters from "@/components/TransactionFilters";
import { parseTransactionFilters } from "@/lib/transactions";

afterEach(cleanup);

describe("TransactionFilters", () => {
  it("is a GET form so filters live in the URL", () => {
    render(<TransactionFilters filters={parseTransactionFilters({})} categories={[]} />);

    const form = screen.getByRole("search", { name: "Filter transactions" }) as HTMLFormElement;
    expect(form.method).toBe("get");
    expect(form.getAttribute("action")).toBe("/transaction-history");
  });

  it("shows the current filters", () => {
    render(
      <TransactionFilters
        filters={parseTransactionFilters({ q: "coffee", type: "debit", category: "Food and Drink", from: "2026-10-01" })}
        categories={["Food and Drink", "Travel"]}
      />,
    );

    expect((screen.getByLabelText("Search") as HTMLInputElement).value).toBe("coffee");
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("debit");
    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("Food and Drink");
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("2026-10-01");
  });

  it("keeps the selected bank when filtering and clearing", () => {
    const { container } = render(
      <TransactionFilters filters={parseTransactionFilters({})} categories={[]} appwriteItemId="bank-1" />,
    );

    expect((container.querySelector('input[name="id"]') as HTMLInputElement).value).toBe("bank-1");
    expect(screen.getByRole("link", { name: "Clear" }).getAttribute("href")).toBe("/transaction-history?id=bank-1");
  });
});
