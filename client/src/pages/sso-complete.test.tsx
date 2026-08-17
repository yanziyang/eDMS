import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { SsoComplete } from "./sso-complete";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function renderComplete(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sso/complete" element={<SsoComplete />} />
        <Route path="/" element={<div>HOME</div>} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SsoComplete", () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
      login: vi.fn(),
      completeSso: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
    });
  });

  it("exchanges the code and navigates home without exposing a token", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
      login: vi.fn(),
      completeSso: complete,
      logout: vi.fn(),
    });

    renderComplete("/sso/complete?code=opaque-code");

    await waitFor(() => expect(complete).toHaveBeenCalledWith("opaque-code"));
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(screen.queryByText(/access token/i)).not.toBeInTheDocument();
  });

  it("shows a friendly provider error and does not exchange a code", async () => {
    const complete = vi.fn();
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
      login: vi.fn(),
      completeSso: complete,
      logout: vi.fn(),
    });

    renderComplete("/sso/complete?error=provider-error");

    expect(await screen.findByRole("heading", { name: "Sign-in could not be completed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
    expect(complete).not.toHaveBeenCalled();
  });

  it("rejects a callback with no code", async () => {
    renderComplete("/sso/complete");

    expect(await screen.findByText(/missing or has expired/i)).toBeInTheDocument();
  });
});
