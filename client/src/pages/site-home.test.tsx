import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { toast } from "sonner";
import { SiteHome } from "./site-home";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Site One",
    description: "A site",
    urlSlug: "site-one",
    storageQuotaBytes: null,
    storageUsedBytes: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function groupDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    name: "Managers",
    description: null,
    isSystem: false,
    siteId: "s1",
    memberIds: ["u1", "u2", "u3"],
    ...overrides,
  };
}

function libraryDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    siteId: "s1",
    name: "Policies",
    description: null,
    enableVersioning: true,
    enableMinorVersions: false,
    requireCheckout: false,
    ...overrides,
  };
}

function permissionEntry(overrides: Record<string, unknown> = {}) {
  return {
    principalType: "Group",
    principalId: "g9",
    principalName: "Site Members",
    level: "Contribute",
    source: "Direct",
    ...overrides,
  };
}

function userDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "u2",
    email: "bob@example.com",
    displayName: "Bob Jones",
    isActive: true,
    isSystemAdmin: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: null,
    ...overrides,
  };
}

function renderSiteHome(slug = "site-one") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/sites/${slug}`]}>
          <Routes>
            <Route path="/sites/:siteSlug" element={<SiteHome />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

function mockSiteRequests(
  overrides: { sites?: Record<string, unknown>[]; groups?: unknown; libraries?: unknown } = {},
) {
  server.use(
    http.get(`${base}/sites`, () => HttpResponse.json(overrides.sites ?? [site()])),
    http.get(`${base}/sites/s1`, () => HttpResponse.json(overrides.sites?.[0] ?? site())),
    http.get(`${base}/groups`, () =>
      HttpResponse.json(
        overrides.groups ??
          [groupDto(), groupDto({ id: "g2", name: "Editors", memberIds: [] })],
      ),
    ),
    http.get(`${base}/sites/s1/libraries`, () =>
      HttpResponse.json(overrides.libraries ?? [libraryDto()]),
    ),
    http.get(`${base}/me/notifications/subscriptions`, () => HttpResponse.json([])),
  );
}

describe("SiteHome", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows a loading indicator first, then libraries and groups", async () => {
    mockSiteRequests();

    renderSiteHome();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Site One" })).toBeInTheDocument();
    expect(screen.getByText("A site")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Policies" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1",
    );
    expect(await screen.findByText("Managers")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(screen.getByText("0 members")).toBeInTheDocument();
  });

  it("creates a document library for the current site", async () => {
    const libraries = [libraryDto()];
    let requestBody: unknown;
    mockSiteRequests({ libraries });
    server.use(
      http.post(`${base}/sites/s1/libraries`, async ({ request }) => {
        requestBody = await request.json();
        libraries.push(
          libraryDto({ id: "l2", name: "Contracts", description: "Contract documents" }),
        );
        return HttpResponse.json("l2", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "New library" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), " Contracts ");
    await user.type(screen.getByLabelText("Description"), "Contract documents");
    await user.click(screen.getByRole("button", { name: "Create library" }));

    await waitFor(() =>
      expect(requestBody).toEqual({
        name: "Contracts",
        description: "Contract documents",
        enableVersioning: true,
        enableMinorVersions: false,
        requireCheckout: false,
        minorVersionsRetained: null,
      }),
    );
    expect(mockedToast.success).toHaveBeenCalledWith("Library created");
    expect(await screen.findByRole("link", { name: "Contracts" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l2",
    );
  });

  it("follows the current site from Site Home", async () => {
    mockSiteRequests();
    let requestBody: unknown;
    server.use(
      http.post(`${base}/Site/objects/s1/follow`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          id: "sub-site",
          objectType: "Site",
          objectId: "s1",
          objectName: "Site One",
          frequency: "Immediate",
          createdAt: "2026-08-17T00:00:00Z",
        });
      }),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(await screen.findByRole("button", { name: "Follow" }));

    await waitFor(() => expect(requestBody).toEqual({ frequency: "Immediate" }));
    expect(mockedToast.success).toHaveBeenCalledWith("Following site");
  });

  it("falls back to a generic description", async () => {
    mockSiteRequests({ sites: [site({ description: null })], groups: [], libraries: [] });

    renderSiteHome();

    expect(await screen.findByText("No description")).toBeInTheDocument();
  });

  it("shows empty states for libraries and groups", async () => {
    mockSiteRequests({ groups: [], libraries: [] });

    renderSiteHome();

    expect(await screen.findByText("No libraries in this site yet.")).toBeInTheDocument();
    expect(screen.getByText("No groups in this site yet.")).toBeInTheDocument();
  });

  it("shows errors when libraries and groups fail to load", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site()])),
      http.get(`${base}/sites/s1`, () => HttpResponse.json(site())),
      http.get(`${base}/groups`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${base}/sites/s1/libraries`, () => new HttpResponse(null, { status: 500 })),
    );

    renderSiteHome();

    expect(await screen.findByText("Failed to load libraries.")).toBeInTheDocument();
    expect(screen.getByText("Failed to load groups.")).toBeInTheDocument();
  });

  it("shows a not-found message when the slug does not match", async () => {
    mockSiteRequests();

    renderSiteHome("missing");

    expect(await screen.findByText("Site not found.")).toBeInTheDocument();
  });

  it("shows a not-found message when the sites request fails", async () => {
    server.use(
      http.get(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    renderSiteHome();

    expect(await screen.findByText("Site not found.")).toBeInTheDocument();
  });

  it("opens the manage access dialog and lists inherited permissions", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({
          hasUniqueAcl: false,
          entries: [
            permissionEntry(),
            permissionEntry({
              principalType: "User",
              principalId: "u1",
              principalName: "Alice",
              level: "FullControl",
              source: "Inherited",
            }),
            permissionEntry({
              principalType: "User",
              principalId: "u3",
              principalName: "Reader",
              level: "Read",
              source: "Inherited",
            }),
            permissionEntry({
              principalType: "Group",
              principalId: "g8",
              principalName: "Blocked",
              level: "NoAccess",
              source: "Direct",
            }),
          ],
        }),
      ),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));

    expect(await screen.findByText("Inherited permissions")).toBeInTheDocument();
    expect(screen.getByText("Site Members")).toBeInTheDocument();
    expect(screen.getByText("Full Control")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getAllByText("Inherited").length).toBe(2);
    expect(screen.getByText("No Access")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop inheriting permissions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grant access" })).not.toBeInTheDocument();
  });

  it("opens and cancels the grant form from the stop-inheriting button", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: false, entries: [] }),
      ),
      http.get(`${base}/users`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Inherited permissions");

    await user.click(screen.getByRole("button", { name: "Stop inheriting permissions" }));

    expect(await screen.findByText("Select a user")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("Select a user")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop inheriting permissions" })).toBeInTheDocument();
  });

  it("shows an error when permissions fail to load in the dialog", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));

    expect(await screen.findByText("Failed to load permissions.")).toBeInTheDocument();
  });

  it("lists a unique ACL with revoke and reset controls", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({
          hasUniqueAcl: true,
          entries: [permissionEntry()],
        }),
      ),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));

    expect(await screen.findByText("Unique permissions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke Site Members" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to inherited" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant access" })).toBeInTheDocument();
  });

  it("grants a permission to a user from the dialog", async () => {
    const posts: Request[] = [];
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(`${base}/Site/objects/s1/permissions`, async ({ request }) => {
        posts.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    expect(await screen.findByText("Unique permissions")).toBeInTheDocument();
    expect(screen.getByText("No permissions granted.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Grant access" }));
    await user.click(screen.getByRole("combobox", { name: "Person" }));
    await user.click(await screen.findByRole("option", { name: "Bob Jones (bob@example.com)" }));

    await user.click(screen.getByRole("combobox", { name: "Permission level" }));
    await user.click(await screen.findByRole("option", { name: "Full Control" }));

    await user.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    await expect(posts[0].json()).resolves.toEqual({
      principalType: "User",
      principalId: "u2",
      level: "FullControl",
    });
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Permission granted"));
  });

  it("shows an error toast when granting fails", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(`${base}/Site/objects/s1/permissions`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Grant access" }));
    await user.click(screen.getByRole("combobox", { name: "Person" }));
    await user.click(await screen.findByRole("option", { name: "Bob Jones (bob@example.com)" }));
    await user.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to grant permission"));
  });

  it("shows an error when the user list fails inside the grant form", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
      http.get(`${base}/users`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Grant access" }));

    expect(await screen.findByText("Failed to load users.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant" })).toBeDisabled();
  });

  it("revokes a permission", async () => {
    const deletes: string[] = [];
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [permissionEntry()] }),
      ),
      http.delete(`${base}/Site/objects/s1/permissions/Group/g9`, ({ request }) => {
        deletes.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Revoke Site Members" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Permission revoked");
  });

  it("shows an error toast when revoking fails", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [permissionEntry()] }),
      ),
      http.delete(`${base}/Site/objects/s1/permissions/Group/g9`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Revoke Site Members" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to revoke permission"));
  });

  it("resets permissions to inherited", async () => {
    const posts: string[] = [];
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
      http.post(`${base}/Site/objects/s1/permissions/reset`, ({ request }) => {
        posts.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Reset to inherited" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Reset to inherited permissions");
  });

  it("shows an error toast when resetting fails", async () => {
    mockSiteRequests();
    server.use(
      http.get(`${base}/Site/objects/s1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
      http.post(`${base}/Site/objects/s1/permissions/reset`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSiteHome();
    await screen.findByRole("heading", { name: "Site One" });

    await user.click(screen.getByRole("button", { name: "Manage access" }));
    await screen.findByText("Unique permissions");
    await user.click(screen.getByRole("button", { name: "Reset to inherited" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to reset permissions"));
  });
});
