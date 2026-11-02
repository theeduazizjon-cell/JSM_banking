// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("id=bank-1&q=coffee&page=2"),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span role="presentation" aria-label={props.alt} /> }));

const { Pagination } = await import("@/components/Pagination");

afterEach(cleanup);

describe("Pagination", () => {
  it("keeps the bank and filters when changing page", () => {
    window.history.pushState({}, "", "/transaction-history");
    render(<Pagination page={2} totalPages={3} />);

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));

    const url = new URL(push.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/transaction-history");
    expect(Object.fromEntries(url.searchParams)).toEqual({ id: "bank-1", q: "coffee", page: "3" });
  });

  it("disables the buttons at either end", () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} />);

    expect((screen.getByRole("button", { name: /Prev/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    rerender(<Pagination page={3} totalPages={3} />);
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
