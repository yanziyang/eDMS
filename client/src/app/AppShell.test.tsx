import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/features/auth/auth-context";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function adminUser(overrides: Partial<{ isSystemAdmin: boolean }> = {}) {
  return {
    id: "u1",
    email: "a@b.c",
    displayName: "Alice",
    isSystemAdmin: overrides.isSystemAdmin ?? false,
    siteMemberships: [],
  };
}

function renderShell(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<div>HOME_CONTENT</div>} />
          <Route path="/admin" element={<div>ADMIN_CONTENT</div>} />
        </Route>
        <Route path="/login" element={<div>LOGIN_PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("shows a loading indicator while the auth status is loading", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "loading",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument();
  });

  it("renders the navigation and user details when authenticated", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByText("HOME_CONTENT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Sites" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "Recycle Bin" })).toHaveAttribute("href", "/recycle-bin");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("a@b.c")).toBeInTheDocument();
  });

  it("hides the admin section for non-admin users", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser({ isSystemAdmin: false }),
      status: "authenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.queryByRole("link", { name: "Admin Center" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("shows the admin section for system admins", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser({ isSystemAdmin: true }),
      status: "authenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.getByRole("link", { name: "Admin Center" })).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Administration")).toBeInTheDocument();
  });

  it("logs out and navigates to /login", async () => {
    const logout = vi.fn().mockImplementation(async () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        status: "unauthenticated",
        login: vi.fn(),
        logout,
      });
    });
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      logout,
    });

    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(screen.getByText("LOGIN_PAGE")).toBeInTheDocument());
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("toggles the mobile navigation menu", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell();

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    await user.click(menuButton);

    const mobileNavLinks = screen.getAllByRole("link", { name: "Search" });
    expect(mobileNavLinks.length).toBeGreaterThan(1);

    const overlay = document.querySelector(".fixed.inset-0") as HTMLElement;
    await user.click(overlay.firstElementChild as HTMLElement);

    await waitFor(() =>
      expect(document.querySelector(".fixed.inset-0")).not.toBeInTheDocument(),
    );
  });

  it("applies the active class to the current nav link", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser({ isSystemAdmin: true }),
      status: "authenticated",
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderShell("/");

    const activeLink = screen.getByRole("link", { name: "My Sites" });
    expect(activeLink.className).toContain("bg-accent");
    const inactiveLink = screen.getByRole("link", { name: "Search" });
    expect(inactiveLink.className).not.toContain("bg-accent");
  });
});
