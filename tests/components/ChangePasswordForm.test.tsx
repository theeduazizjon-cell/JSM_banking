// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const changePassword = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/user.actions", () => ({ changePassword }));

const { default: ChangePasswordForm } = await import("@/components/ChangePasswordForm");

afterEach(cleanup);

const fill = (values: Record<string, string>) => {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.input(screen.getByLabelText(label), { target: { value } });
  }
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Update password" }));

const valid = {
  "Current password": "old-password",
  "New password": "new-password-1",
  "Confirm new password": "new-password-1",
};

describe("ChangePasswordForm", () => {
  it("labels every field for password managers and screen readers", () => {
    render(<ChangePasswordForm />);

    expect(screen.getByLabelText("Current password").getAttribute("autocomplete")).toBe("current-password");
    expect(screen.getByLabelText("New password").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByLabelText("Confirm new password").getAttribute("type")).toBe("password");
  });

  it("shows validation errors without calling the server", async () => {
    render(<ChangePasswordForm />);
    fill({ ...valid, "Confirm new password": "something-else" });
    submit();

    expect(await screen.findByText("Passwords don't match")).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("confirms success and clears the fields", async () => {
    changePassword.mockResolvedValue({ ok: true });
    render(<ChangePasswordForm />);
    fill(valid);
    submit();

    expect((await screen.findByRole("status")).textContent).toBe("Password updated.");
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "old-password",
      newPassword: "new-password-1",
      confirmPassword: "new-password-1",
    });
    expect((screen.getByLabelText("Current password") as HTMLInputElement).value).toBe("");
  });

  it("shows the server's error as an alert and keeps the input", async () => {
    changePassword.mockResolvedValue({ ok: false, error: "Your current password is incorrect." });
    render(<ChangePasswordForm />);
    fill(valid);
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Your current password is incorrect.");
    expect((screen.getByLabelText("New password") as HTMLInputElement).value).toBe("new-password-1");
  });

  it("recovers when the request itself fails", async () => {
    changePassword.mockRejectedValue(new Error("network down"));
    render(<ChangePasswordForm />);
    fill(valid);
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Something went wrong. Please try again.");
    await waitFor(() => expect((screen.getByRole("button", { name: "Update password" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
