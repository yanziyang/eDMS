import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { ThemeProvider } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { useAuth } from "@/features/auth/auth-context";
import { server } from "@/test/server";

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

afterEach(() => {
  window.localStorage.removeItem("edms-nav-collapsed");
  window.localStorage.removeItem("edms-theme");
});

function adminUser(
  overrides: Partial<{
    isSystemAdmin: boolean;
    siteMemberships: Array<{ siteId: string; siteSlug: string; role: "Owner" | "Member" | "Visitor" }>;
  }> = {},
) {
  return {
    id: "u1",
    email: "a@b.c",
    displayName: "Alice",
    isSystemAdmin: overrides.isSystemAdmin ?? false,
    siteMemberships: overrides.siteMemberships ?? [],
  };
}

function renderShell(
  initialPath = "/",
  notificationsHandler: () => Response | Promise<Response> = () => HttpResponse.json([]),
) {
  server.use(
    http.get("http://localhost:5080/api/v1/me/notifications", notificationsHandler),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider attribute="class">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<div>HOME_CONTENT</div>} />
              <Route path="/admin" element={<div>ADMIN_CONTENT</div>} />
              <Route path="/sites/:siteSlug/libraries/:libraryId" element={<div>LIBRARY_CONTENT</div>} />
            </Route>
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("AppShell", () => {
  it("shows a loading indicator while the auth status is loading", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "loading",
      login: vi.fn(),
      completeSso: vi.fn(),
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
      completeSso: vi.fn(),
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
      completeSso: vi.fn(),
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
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(screen.queryByRole("link", { name: "Admin Center" })).not.toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("keeps the current site when opening the recycle bin from a library", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    renderShell("/sites/site-one/libraries/l1");

    expect(screen.getByText("LIBRARY_CONTENT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recycle Bin" })).toHaveAttribute(
      "href",
      "/recycle-bin/site-one",
    );
  });

  it("shows the admin section for system admins", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser({ isSystemAdmin: true }),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
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
        completeSso: vi.fn(),
        logout,
      });
    });
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
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
      completeSso: vi.fn(),
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

  it("collapses desktop navigation and persists the preference", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));

    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByLabelText("Application navigation")).toHaveAttribute(
      "data-collapsed",
      "true",
    );
    expect(window.localStorage.getItem("edms-nav-collapsed")).toBe("true");
    expect(within(screen.getByRole("link", { name: "Search" })).getByText("Search")).toHaveClass(
      "sr-only",
    );
  });

  it("expands the navigation back to the full rail", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    expect(screen.getByRole("button", { name: "Collapse navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByLabelText("Application navigation")).toHaveAttribute(
      "data-collapsed",
      "false",
    );
    expect(window.localStorage.getItem("edms-nav-collapsed")).toBe("false");
  });

  it("shows tooltips on collapsed navigation links", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Collapse navigation" }));
    await user.hover(screen.getByRole("link", { name: "Search" }));

    expect(await screen.findByRole("tooltip", { name: "Search" })).toBeInTheDocument();
  });

  it("shows site shortcut links for membership sites", async () => {
    server.use(
      http.get("http://localhost:5080/api/v1/me/notifications", () => HttpResponse.json([])),
      http.get("http://localhost:5080/api/v1/sites", () =>
        HttpResponse.json([
          { id: "s1", name: "Alpha Site", description: null, urlSlug: "alpha" },
          { id: "s2", name: "Beta Site", description: null, urlSlug: "beta" },
        ]),
      ),
    );
    mockedUseAuth.mockReturnValue({
      user: adminUser({
        siteMemberships: [
          { siteId: "s1", siteSlug: "alpha", role: "Owner" },
          { siteId: "s2", siteSlug: "beta", role: "Member" },
        ],
      }),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    renderShell();

    expect(await screen.findByRole("link", { name: "Alpha Site" })).toHaveAttribute(
      "href",
      "/sites/alpha",
    );
    expect(screen.getByRole("link", { name: "Beta Site" })).toHaveAttribute("href", "/sites/beta");
  });

  it("shows the unread badge and marks all notifications as read", async () => {
    let readAllCalls = 0;
    server.use(
      http.post("http://localhost:5080/api/v1/me/notifications/read-all", () => {
        readAllCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell("/", () =>
      HttpResponse.json([
        {
          id: "n1",
          message: "Contract.pdf was uploaded",
          objectName: "Documents",
          occurredAt: "2026-08-18T09:00:00Z",
          isRead: false,
        },
        {
          id: "n2",
          message: "Access was granted",
          objectName: "Policies",
          occurredAt: "2026-08-18T08:00:00Z",
          isRead: true,
        },
      ]),
    );

    await user.click(await screen.findByRole("button", { name: "Notifications (1 unread)" }));
    expect(screen.getByText("Contract.pdf was uploaded")).toBeInTheDocument();
    expect(screen.getByText("Access was granted")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => expect(readAllCalls).toBe(1));
  });

  it("marks a single notification as read when selected", async () => {
    let readCalls: string[] = [];
    server.use(
      http.post("http://localhost:5080/api/v1/me/notifications/n1/read", () => {
        readCalls = [...readCalls, "n1"];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell("/", () =>
      HttpResponse.json([
        {
          id: "n1",
          message: "Contract.pdf was uploaded",
          objectName: "Documents",
          occurredAt: "2026-08-18T09:00:00Z",
          isRead: false,
        },
      ]),
    );

    await user.click(await screen.findByRole("button", { name: "Notifications (1 unread)" }));
    await user.click(screen.getByText("Contract.pdf was uploaded"));

    await waitFor(() => expect(readCalls).toEqual(["n1"]));
  });

  it("shows an error state when notifications fail to load", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell("/", () => new HttpResponse(null, { status: 500 }));

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(
      await screen.findByText("Unable to load notifications.", undefined, { timeout: 20_000 }),
    ).toBeInTheDocument();
  }, 25_000);

  it("switches the visual theme from the appearance menu", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Choose theme" }));
    await user.click(await screen.findByRole("menuitem", { name: /Ocean/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean");
    expect(window.localStorage.getItem("edms-theme")).toBe("ocean");
  });

  it("applies the active class to the current nav link", () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser({ isSystemAdmin: true }),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    renderShell("/");

    const activeLink = screen.getByRole("link", { name: "My Sites" });
    expect(activeLink.className).toContain("bg-accent");
    const inactiveLink = screen.getByRole("link", { name: "Search" });
    expect(inactiveLink.className).not.toContain("bg-accent");
  });

  it("toggles between light and dark theme", async () => {
    mockedUseAuth.mockReturnValue({
      user: adminUser(),
      status: "authenticated",
      login: vi.fn(),
      completeSso: vi.fn(),
      logout: vi.fn(),
    });

    const user = userEvent.setup();
    renderShell("/");

    const toggle = screen.getByRole("button", { name: /Switch to dark mode/ });
    await user.click(toggle);

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    const lightToggle = screen.getByRole("button", { name: /Switch to light mode/ });
    await user.click(lightToggle);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
