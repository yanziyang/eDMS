import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/auth-context";
import { login, me } from "@/features/auth/api";
import { Login } from "./login";

vi.mock("@/features/auth/api", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

const mockedLogin = vi.mocked(login);
const mockedMe = vi.mocked(me);

function currentUser() {
  return { id: "u1", email: "a@b.c", displayName: "A", isSystemAdmin: false, siteMemberships: [] };
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  it("renders the form", () => {
    mockedMe.mockResolvedValue(currentUser());

    renderLogin();

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  });

  it("logs in and navigates home", async () => {
    mockedMe.mockResolvedValue(currentUser());
    mockedLogin.mockResolvedValue({
      accessToken: "tok-1",
      expiresInSeconds: 900,
      user: currentUser(),
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@company.com"), "a@b.c");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByText("HOME")).toBeInTheDocument());
    expect(mockedLogin).toHaveBeenCalledWith("a@b.c", "secret");
  });

  it("trims the email before submitting", async () => {
    mockedMe.mockResolvedValue(currentUser());
    mockedLogin.mockResolvedValue({
      accessToken: "tok-1",
      expiresInSeconds: 900,
      user: currentUser(),
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@company.com"), "  a@b.c  ");
    await user.type(screen.getByPlaceholderText("Enter your password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(mockedLogin).toHaveBeenCalledWith("a@b.c", "secret"));
  });

  it("shows an error when credentials are rejected", async () => {
    mockedMe.mockResolvedValue(currentUser());
    mockedLogin.mockRejectedValue(new Error("bad credentials"));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByPlaceholderText("you@company.com"), "a@b.c");
    await user.type(screen.getByPlaceholderText("Enter your password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    mockedMe.mockResolvedValue(currentUser());

    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByPlaceholderText("Enter your password");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
