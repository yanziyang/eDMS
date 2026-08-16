import { Component, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/api-client";
import { AuthProvider, useAuth } from "./auth-context";
import { login, logout, me } from "./api";

vi.mock("@/lib/api-client", () => ({
  setAccessToken: vi.fn(),
}));

vi.mock("./api", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}));

const mockedLogin = vi.mocked(login);
const mockedLogout = vi.mocked(logout);
const mockedMe = vi.mocked(me);
const mockedSetAccessToken = vi.mocked(setAccessToken);

class ErrorBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function Probe() {
  const { user, status, login: doLogin, logout: doLogout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user ? user.email : "none"}</span>
      <button onClick={() => doLogin("a@b.c", "pw")}>login</button>
      <button onClick={() => doLogout()}>logout</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("auth-context", () => {
  it("resolves to authenticated when me() succeeds", async () => {
    mockedMe.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isSystemAdmin: false,
      siteMemberships: [],
    });

    renderProbe();

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("a@b.c");
  });

  it("resolves to unauthenticated when me() fails", async () => {
    mockedMe.mockRejectedValue(new Error("401"));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
  });

  it("ignores the me() result when the provider unmounts", async () => {
    let resolveMe: (value: Awaited<ReturnType<typeof me>>) => void;
    mockedMe.mockReturnValue(
      new Promise((resolve) => {
        resolveMe = resolve;
      }),
    );

    const { unmount } = renderProbe();
    unmount();

    resolveMe!({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isSystemAdmin: false,
      siteMemberships: [],
    });
    await Promise.resolve();
  });

  it("ignores the me() rejection when the provider unmounts", async () => {
    let rejectMe: (reason: Error) => void;
    mockedMe.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMe = reject;
      }),
    );

    const { unmount } = renderProbe();
    unmount();

    rejectMe!(new Error("401"));
    await Promise.resolve();
  });

  it("login stores the token and user", async () => {
    mockedMe.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isSystemAdmin: false,
      siteMemberships: [],
    });
    mockedLogin.mockResolvedValue({
      accessToken: "tok-1",
      expiresInSeconds: 900,
      user: { id: "u2", email: "b@c.d", displayName: "B", isSystemAdmin: true, siteMemberships: [] },
    });

    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("b@c.d"));
    expect(mockedLogin).toHaveBeenCalledWith("a@b.c", "pw");
    expect(mockedSetAccessToken).toHaveBeenCalledWith("tok-1");
  });

  it("logout clears the session when the API call succeeds", async () => {
    mockedMe.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isSystemAdmin: false,
      siteMemberships: [],
    });
    mockedLogout.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("user")).toHaveTextContent("none");
    expect(mockedSetAccessToken).toHaveBeenLastCalledWith(null);
  });

  it("logout clears the session even when the API call fails", async () => {
    mockedMe.mockResolvedValue({
      id: "u1",
      email: "a@b.c",
      displayName: "A",
      isSystemAdmin: false,
      siteMemberships: [],
    });
    mockedLogout.mockRejectedValue(new Error("network"));

    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    await user.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(mockedSetAccessToken).toHaveBeenLastCalledWith(null);
  });

  it("throws when used outside the provider", () => {
    let caught: unknown;
    render(
      <ErrorBoundary onError={(error) => (caught = error)}>
        <Probe />
      </ErrorBoundary>,
    );

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("useAuth must be used within an AuthProvider");
  });
});
