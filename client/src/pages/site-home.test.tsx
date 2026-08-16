import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { SiteHome } from "./site-home";

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

function renderSiteHome(slug = "site-one") {
  return render(
    <MemoryRouter initialEntries={[`/sites/${slug}`]}>
      <Routes>
        <Route path="/sites/:siteSlug" element={<SiteHome />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SiteHome", () => {
  it("shows a loading indicator first, then libraries and groups", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site()])),
      http.get(`${base}/groups`, () =>
        HttpResponse.json([
          { id: "g1", name: "Managers", description: null, isSystem: false, siteId: "s1", memberIds: ["u1", "u2", "u3"] },
          { id: "g2", name: "Editors", description: null, isSystem: false, siteId: "s1", memberIds: [] },
        ]),
      ),
      http.get(`${base}/sites/s1/libraries`, () =>
        HttpResponse.json([{ id: "l1", siteId: "s1", name: "Policies", description: null, enableVersioning: true, enableMinorVersions: false, requireCheckout: false }]),
      ),
    );

    renderSiteHome();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Site One" })).toBeInTheDocument();
    expect(screen.getByText("A site")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Policies" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1",
    );
    expect(screen.getByText("Managers")).toBeInTheDocument();
    expect(screen.getByText("3 members")).toBeInTheDocument();
    expect(screen.getByText("0 members")).toBeInTheDocument();
  });

  it("falls back to a generic description", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site({ description: null })])),
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.get(`${base}/sites/s1/libraries`, () => HttpResponse.json([])),
    );

    renderSiteHome();

    expect(await screen.findByText("No description")).toBeInTheDocument();
  });

  it("shows a not-found message when the slug does not match", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([site()])),
      http.get(`${base}/groups`, () => HttpResponse.json([])),
      http.get(`${base}/sites/s1/libraries`, () => HttpResponse.json([])),
    );

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
});
