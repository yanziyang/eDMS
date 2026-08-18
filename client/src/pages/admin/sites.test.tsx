import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminSites } from "./sites";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function siteDto(overrides: Record<string, unknown> = {}) {
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

function renderSites() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminSites />
      </QueryClientProvider>,
    ),
  };
}

describe("AdminSites", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("lists sites with their slugs", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto(), siteDto({ id: "s2", name: "Site Two", urlSlug: "site-two" })])),
    );

    renderSites();

    expect(await screen.findByText("Site One")).toBeInTheDocument();
    expect(screen.getByText("site-one")).toBeInTheDocument();
    expect(screen.getByText("Site Two")).toBeInTheDocument();
    expect(screen.getByText("site-two")).toBeInTheDocument();
  });

  it("creates a site and resets the form", async () => {
    const sites = [siteDto()];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json(sites)),
      http.post(`${base}/sites`, async ({ request }) => {
        requests.push(request);
        sites.push(siteDto({ id: "s9", name: "New Site", urlSlug: "new-site" }));
        return HttpResponse.json("s9", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderSites();
    await screen.findByText("Site One");

    expect(screen.getByRole("button", { name: "Create site" }).closest("form")).toHaveClass("items-start");
    expect(screen.getByRole("button", { name: "Create site" })).toHaveClass("mt-6");

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "New Site");
    expect(inputs[1]).toHaveValue("new-site");
    await user.click(screen.getByRole("button", { name: "Create site" }));

    expect(await screen.findByText("New Site")).toBeInTheDocument();
    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("");
    await expect(requests[0].json()).resolves.toEqual({ name: "New Site", urlSlug: "new-site" });
  });

  it("reports a failed site creation", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.post(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSites();
    await screen.findByText("Site One");

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "New Site");
    await user.clear(inputs[1]);
    await user.type(inputs[1], "new-site");
    await user.click(screen.getByRole("button", { name: "Create site" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to create site"));
  });

  it("shows the server validation message when site creation is rejected", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.post(`${base}/sites`, () =>
        HttpResponse.json(
          {
            type: "urn:edms:validation-error",
            title: "One or more validation errors occurred.",
            status: 400,
            errors: { UrlSlug: ["URL slug must be lowercase letters, numbers, and single hyphens."] },
          },
          { status: 400 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderSites();
    await user.type((await screen.findAllByRole("textbox"))[0], "New Site");
    await user.click(screen.getByRole("button", { name: "Create site" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(
        "URL slug must be lowercase letters, numbers, and single hyphens.",
      ),
    );
  });

  it("deletes a site and reloads", async () => {
    const sites = [siteDto()];
    const urls: string[] = [];
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json(sites)),
      http.delete(`${base}/sites/s1`, ({ request }) => {
        urls.push(request.url);
        sites.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSites();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("Site One")).not.toBeInTheDocument());
  });

  it("reports a failed site deletion", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.delete(`${base}/sites/s1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSites();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete site"));
  });
});
