import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { toast } from "sonner";
import { RecycleBin } from "./recycle-bin";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Site One",
    description: null,
    urlSlug: "site-one",
    storageQuotaBytes: null,
    storageUsedBytes: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function recycleItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    kind: "document",
    name: "old-contract.pdf",
    deletedAt: "2026-08-10T10:00:00Z",
    deletedBy: "u-alice",
    deletedByDisplayName: "Alice",
    siteId: "s1",
    ...overrides,
  };
}

function mockSites(
  sites: Record<string, unknown>[] = [
    site(),
    site({ id: "s2", name: "Site Two", urlSlug: "site-two" }),
  ],
) {
  server.use(http.get(`${base}/sites`, () => HttpResponse.json(sites)));
}

function renderRecycleBin(path = "/recycle-bin") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/recycle-bin" element={<RecycleBin />} />
            <Route path="/recycle-bin/:siteSlug" element={<RecycleBin />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

describe("RecycleBin", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("asks for a site and lists items after picking one", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () =>
        HttpResponse.json([
          recycleItem(),
          recycleItem({
            id: "r2",
            kind: "folder",
            name: "Old folder",
            deletedBy: "u-bob",
            deletedByDisplayName: "Bob",
          }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderRecycleBin();

    expect(await screen.findByText("Select a site to see its recycle bin.")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Site One" }));

    expect(await screen.findByText("old-contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("Old folder")).toBeInTheDocument();
    expect(screen.getByText("document")).toBeInTheDocument();
    expect(screen.getByText("folder")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByTitle("User ID: u-alice")).toHaveTextContent("Alice");
    expect(screen.getByText("2 items · deleted items are kept for 90 days before being permanently purged.")).toBeInTheDocument();
  });

  it("lists items directly when the site slug is in the URL", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([recycleItem()])),
    );

    renderRecycleBin("/recycle-bin/site-one");

    expect(await screen.findByText("old-contract.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Site" })).not.toBeInTheDocument();
  });

  it("falls back to the user ID or an unknown-user label", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () =>
        HttpResponse.json([
          recycleItem({ id: "r2", name: "legacy.pdf", deletedByDisplayName: null }),
          recycleItem({
            id: "r3",
            name: "orphaned.txt",
            deletedBy: null,
            deletedByDisplayName: null,
          }),
        ]),
      ),
    );

    renderRecycleBin("/recycle-bin/site-one");

    expect(await screen.findByText("u-alice")).toBeInTheDocument();
    expect(screen.getByText("Unknown user")).toBeInTheDocument();
    expect(screen.getByTitle("User ID: u-alice")).toHaveTextContent("u-alice");
  });

  it("shows not-found when the slug does not match any site", async () => {
    mockSites();

    renderRecycleBin("/recycle-bin/missing");

    expect(await screen.findByText("Site not found.")).toBeInTheDocument();
  });

  it("shows an error when sites fail to load with a slug", async () => {
    server.use(
      http.get(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    renderRecycleBin("/recycle-bin/site-one");

    expect(await screen.findByText("Failed to load sites.")).toBeInTheDocument();
  });

  it("shows an error when sites fail to load without a slug", async () => {
    server.use(
      http.get(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    renderRecycleBin();

    expect(await screen.findByText("Failed to load sites.")).toBeInTheDocument();
  });

  it("shows a message when the user has no sites", async () => {
    mockSites([]);

    renderRecycleBin();

    expect(
      await screen.findByText("You do not have access to any sites yet."),
    ).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([])),
    );

    renderRecycleBin("/recycle-bin/site-one");

    expect(await screen.findByText("Recycle Bin is empty")).toBeInTheDocument();
  });

  it("shows an error when the recycle bin fails to load", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => new HttpResponse(null, { status: 500 })),
    );

    renderRecycleBin("/recycle-bin/site-one");

    expect(await screen.findByText("Failed to load recycle bin.")).toBeInTheDocument();
  });

  it("restores a document", async () => {
    mockSites();
    const items: unknown[] = [recycleItem()];
    const posts: string[] = [];
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json(items)),
      http.post(`${base}/recycle-bin/r1/restore`, ({ request }) => {
        posts.push(request.url);
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toContain("objectType=Document");
    expect(mockedToast.success).toHaveBeenCalledWith("Item restored");
    expect(await screen.findByText("Recycle Bin is empty")).toBeInTheDocument();
  });

  it("restores a folder with the folder object type", async () => {
    mockSites();
    const posts: string[] = [];
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () =>
        HttpResponse.json([recycleItem({ id: "r2", kind: "folder", name: "Old folder" })]),
      ),
      http.post(`${base}/recycle-bin/r2/restore`, ({ request }) => {
        posts.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("Old folder");

    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toContain("objectType=Folder");
  });

  it("reports a failed restore", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([recycleItem()])),
      http.post(`${base}/recycle-bin/r1/restore`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to restore item"));
  });

  it("permanently deletes an item after confirmation", async () => {
    mockSites();
    const items: unknown[] = [recycleItem()];
    const deletes: string[] = [];
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json(items)),
      http.delete(`${base}/recycle-bin/r1`, ({ request }) => {
        deletes.push(request.url);
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Permanently delete old-contract.pdf" }));
    expect(
      screen.getByText('"old-contract.pdf" will be permanently deleted and cannot be recovered.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete forever" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(deletes[0]).toContain("objectType=Document");
    expect(mockedToast.success).toHaveBeenCalledWith("Item permanently deleted");
    expect(await screen.findByText("Recycle Bin is empty")).toBeInTheDocument();
  });

  it("cancels a permanent delete without calling the API", async () => {
    mockSites();
    let deletes = 0;
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([recycleItem()])),
      http.delete(`${base}/recycle-bin/r1`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Permanently delete old-contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Delete forever" })).not.toBeInTheDocument();
    await waitFor(() => expect(deletes).toBe(0));
  });

  it("closes the permanent delete dialog with the X button", async () => {
    mockSites();
    let deletes = 0;
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([recycleItem()])),
      http.delete(`${base}/recycle-bin/r1`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Permanently delete old-contract.pdf" }));
    expect(screen.getByRole("button", { name: "Delete forever" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("button", { name: "Delete forever" })).not.toBeInTheDocument();
    await waitFor(() => expect(deletes).toBe(0));
  });

  it("reports a failed permanent delete", async () => {
    mockSites();
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () => HttpResponse.json([recycleItem()])),
      http.delete(`${base}/recycle-bin/r1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderRecycleBin("/recycle-bin/site-one");
    await screen.findByText("old-contract.pdf");

    await user.click(screen.getByRole("button", { name: "Permanently delete old-contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Delete forever" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete item"));
  });
});
