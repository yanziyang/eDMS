import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { Home } from "./home";

const base = "http://localhost:5080/api/v1";

function site(overrides: Partial<Record<"id" | "name" | "description" | "urlSlug" | "storageUsedBytes", unknown>> = {}) {
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

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Home", () => {
  it("shows a loading indicator first, then the sites", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site()])),
    );

    renderHome();

    expect(screen.getByText("Loading.")).toBeInTheDocument();
    expect(await screen.findByText("Site One")).toBeInTheDocument();
    expect(screen.getByText("A site")).toBeInTheDocument();
    expect(screen.getByText("0 B used")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Site One/ })).toHaveAttribute("href", "/sites/site-one");
  });

  it("shows the empty state when there are no sites", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([])),
    );

    renderHome();

    expect(
      await screen.findByText("You do not have access to any sites yet."),
    ).toBeInTheDocument();
  });

  it("falls back to an empty description label", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site({ description: null })])),
    );

    renderHome();

    expect(await screen.findByText("No description")).toBeInTheDocument();
  });

  it("formats storage sizes across units", async () => {
    server.use(
      http.get(`${base}/sites`, () =>
        HttpResponse.json([
          site({ id: "a", name: "Small", storageUsedBytes: 500 }),
          site({ id: "b", name: "Kilo", storageUsedBytes: 1536 }),
          site({ id: "c", name: "Mega", storageUsedBytes: 5 * 1024 * 1024 }),
          site({ id: "d", name: "Giga", storageUsedBytes: 2 * 1024 * 1024 * 1024 }),
        ]),
      ),
    );

    renderHome();

    expect(await screen.findByText("500 B used")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB used")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB used")).toBeInTheDocument();
    expect(screen.getByText("2.0 GB used")).toBeInTheDocument();
  });

  it("shows the empty state when the request fails", async () => {
    server.use(
      http.get(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    renderHome();

    expect(
      await screen.findByText("You do not have access to any sites yet."),
    ).toBeInTheDocument();
  });

  it("shows recent documents with their location, time, and deep link", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([])),
      http.get(`${base}/me/recent`, () =>
        HttpResponse.json([
          {
            documentId: "d1",
            name: "Contract.pdf",
            siteId: "s1",
            siteName: "Site One",
            siteSlug: "site-one",
            libraryId: "l1",
            libraryName: "Documents",
            folderId: null,
            folderPath: null,
            lastTouchedAt: "2026-08-17T10:00:00Z",
            lastAction: "View",
          },
        ]),
      ),
    );

    renderHome();

    expect(await screen.findByRole("heading", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByText("Contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("Site One / Documents")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contract\.pdf Site One \/ Documents/ })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1?documentId=d1",
    );
  });

  it("shows the empty recent state for a new user", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([])),
      http.get(`${base}/me/recent`, () => HttpResponse.json([])),
    );

    renderHome();

    expect(await screen.findByText("No recent documents yet.")).toBeInTheDocument();
  });
});
