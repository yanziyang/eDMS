import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { AdminSites } from "./sites";

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

describe("AdminSites", () => {
  it("lists sites with their slugs", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto(), siteDto({ id: "s2", name: "Site Two", urlSlug: "site-two" })])),
    );

    render(<AdminSites />);

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
    render(<AdminSites />);
    await screen.findByText("Site One");

    const inputs = screen.getAllByRole("textbox");
    await user.type(inputs[0], "New Site");
    await user.type(inputs[1], "new-site");
    await user.click(screen.getByRole("button", { name: "Create site" }));

    expect(await screen.findByText("New Site")).toBeInTheDocument();
    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("");
    await expect(requests[0].json()).resolves.toEqual({ name: "New Site", urlSlug: "new-site" });
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
    render(<AdminSites />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => expect(urls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText("Site One")).not.toBeInTheDocument());
  });
});
