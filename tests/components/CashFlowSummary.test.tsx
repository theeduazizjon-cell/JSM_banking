// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Chart.js needs a real canvas; the chart itself is covered by summarizeCashFlow's tests
vi.mock("@/components/CashFlowChart", () => ({
  default: ({ data }: { data: { month: string }[] }) => <div data-testid="chart">{data.length} months</div>,
}));

const { default: CashFlowSummary } = await import("@/components/CashFlowSummary");

const tx = (amount: number, type: "debit" | "credit", date: string, pending = false) =>
  ({ id: `${type}-${amount}-${date}`, amount, type, date, pending, category: "Other", name: "x" }) as Transaction;

const stat = (label: string) => within(screen.getByText(label).parentElement!).getByRole("definition").textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CashFlowSummary", () => {
  it("shows this month's income, expenses and net", () => {
    render(<CashFlowSummary transactions={[
      tx(3200, "credit", "2026-11-01"),
      tx(1200.5, "debit", "2026-11-03"),
      tx(99, "debit", "2026-11-04", true),
      tx(500, "debit", "2026-10-10"),
    ]} />);

    expect(stat("Income this month")).toBe("$3,200.00");
    expect(stat("Expenses this month")).toBe("$1,200.50");
    expect(stat("Net this month")).toBe("+$1,999.50");
    expect(screen.getByTestId("chart").textContent).toBe("6 months");
  });

  it("shows a negative net", () => {
    render(<CashFlowSummary transactions={[tx(40, "debit", "2026-11-02")]} />);

    expect(stat("Net this month")).toBe("-$40.00");
  });

  it("shows an empty state instead of a blank chart", () => {
    render(<CashFlowSummary transactions={[tx(10, "debit", "2026-11-02", true)]} />);

    expect(screen.queryByTestId("chart")).toBeNull();
    expect(screen.getByText("No settled transactions in the last six months yet.")).toBeTruthy();
  });
});
