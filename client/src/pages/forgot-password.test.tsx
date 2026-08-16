import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { forgotPassword } from "@/features/auth/api";
import { ForgotPassword } from "./forgot-password";

vi.mock("@/features/auth/api", () => ({
  forgotPassword: vi.fn(),
}));

const mockedForgotPassword = vi.mocked(forgotPassword);

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe("ForgotPassword", () => {
  it("renders the form", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: /eDMS/ })).toHaveAttribute("href", "/login");
  });

  it("shows the confirmation screen after submitting", async () => {
    mockedForgotPassword.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("you@company.com"), " a@b.c ");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(screen.getByText("a@b.c")).toBeInTheDocument();
    expect(mockedForgotPassword).toHaveBeenCalledWith("a@b.c");
  });

  it("shows the confirmation screen even when the request fails (no account enumeration)", async () => {
    mockedForgotPassword.mockRejectedValue(new Error("network"));

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("you@company.com"), "a@b.c");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(mockedForgotPassword).toHaveBeenCalledWith("a@b.c");
  });

  it("falls back to a generic placeholder for an empty email", async () => {
    mockedForgotPassword.mockResolvedValue(undefined);

    const { container } = renderPage();

    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(screen.getByText("your email address")).toBeInTheDocument();
    expect(mockedForgotPassword).toHaveBeenCalledWith("");
  });
});
