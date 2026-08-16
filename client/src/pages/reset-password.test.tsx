import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { resetPassword } from "@/features/auth/api";
import { ResetPassword } from "./reset-password";

vi.mock("@/features/auth/api", () => ({
  resetPassword: vi.fn(),
}));

const mockedResetPassword = vi.mocked(resetPassword);

function renderPage(params = "email=a@b.c&token=tok-1") {
  return render(
    <MemoryRouter initialEntries={[`/reset-password?${params}`]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function passwordInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]'));
}

describe("ResetPassword", () => {
  it("renders the form with the email from the query string", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    expect(screen.getByText(/a@b\.c/)).toBeInTheDocument();
    expect(passwordInputs()).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Set new password" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("rejects mismatched passwords without calling the API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(passwordInputs()[0], "pass-one");
    await user.type(passwordInputs()[1], "pass-two");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it("resets the password and navigates to /login", async () => {
    mockedResetPassword.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await user.type(passwordInputs()[0], "new-pass-1");
    await user.type(passwordInputs()[1], "new-pass-1");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    await waitFor(() => expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument());
    expect(mockedResetPassword).toHaveBeenCalledWith("a@b.c", "tok-1", "new-pass-1");
  });

  it("shows an error when the reset token is rejected", async () => {
    mockedResetPassword.mockRejectedValue(new Error("invalid token"));

    const user = userEvent.setup();
    renderPage();

    await user.type(passwordInputs()[0], "new-pass-1");
    await user.type(passwordInputs()[1], "new-pass-1");
    await user.click(screen.getByRole("button", { name: "Set new password" }));

    expect(await screen.findByText("The reset link is invalid or has expired.")).toBeInTheDocument();
  });

  it("shows an empty email target when no query params are present", () => {
    renderPage("");

    expect(screen.getByText("Choose a new password for .")).toBeInTheDocument();
  });
});
