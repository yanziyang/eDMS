import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { createSite, deleteSite, getSite, listSites, updateSite } from "./api";

const base = "http://localhost:5080/api/v1";

describe("sites api", () => {
  it("listSites gets /sites", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([{ id: "s1", name: "Site" }])),
    );

    const result = await listSites();

    expect(result).toEqual([{ id: "s1", name: "Site" }]);
  });

  it("getSite gets a site by id", async () => {
    server.use(
      http.get(`${base}/sites/s1`, () => HttpResponse.json({ id: "s1", name: "Site" })),
    );

    const result = await getSite("s1");

    expect(result).toEqual({ id: "s1", name: "Site" });
  });

  it("createSite posts name, description and slug", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/sites`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("s9", { status: 201 });
      }),
    );

    const id = await createSite({ name: "Ops", description: "desc", urlSlug: "ops" });

    expect(id).toBe("s9");
    await expect(requests[0].json()).resolves.toEqual({ name: "Ops", description: "desc", urlSlug: "ops" });
  });

  it("updateSite puts the editable fields", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/sites/s1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateSite("s1", { name: "New", description: "d", storageQuotaBytes: 123 });

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ name: "New", description: "d", storageQuotaBytes: 123 });
  });

  it("updateSite allows a null quota", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/sites/s1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateSite("s1", { name: "New", storageQuotaBytes: null });

    await expect(requests[0].json()).resolves.toEqual({ name: "New", storageQuotaBytes: null });
  });

  it("deleteSite deletes the site", async () => {
    let called = false;
    server.use(
      http.delete(`${base}/sites/s1`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteSite("s1");

    expect(called).toBe(true);
  });
});
