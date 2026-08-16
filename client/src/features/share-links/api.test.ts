import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import type { ShareLinkDto } from "@/types/api";
import { createShareLink, listShareLinks, revokeShareLink } from "./api";

const base = "http://localhost:5080/api/v1";

describe("share-links api", () => {
  it("createShareLink posts a new Read link without an expiry", async () => {
    const requests: Request[] = [];
    const link: ShareLinkDto = { id: "l1", token: "tok-1", level: "Read", expiresAt: null };
    server.use(
      http.post(`${base}/Document/objects/d1/share-links`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json(link);
      }),
    );

    const result = await createShareLink("Document", "d1", "Read");

    expect(result).toEqual(link);
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ level: "Read" });
  });

  it("createShareLink sends the expiresAt when provided", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/Document/objects/d1/share-links`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json({
          id: "l1",
          token: "tok-1",
          level: "Contribute",
          expiresAt: "2026-09-01T00:00:00Z",
        });
      }),
    );

    const result = await createShareLink("Document", "d1", "Contribute", "2026-09-01T00:00:00Z");

    expect(result.level).toBe("Contribute");
    await expect(requests[0].json()).resolves.toEqual({
      level: "Contribute",
      expiresAt: "2026-09-01T00:00:00Z",
    });
  });

  it("createShareLink throws when the request fails", async () => {
    server.use(
      http.post(`${base}/Document/objects/d1/share-links`, () =>
        new HttpResponse(null, { status: 400 }),
      ),
    );

    await expect(createShareLink("Document", "d1", "Read")).rejects.toMatchObject({ status: 400 });
  });

  it("listShareLinks gets the active links for an object", async () => {
    const links: ShareLinkDto[] = [
      { id: "l1", token: "tok-1", level: "Read", expiresAt: null },
      { id: "l2", token: "tok-2", level: "Read", expiresAt: "2026-09-01T00:00:00Z" },
    ];
    server.use(http.get(`${base}/Document/objects/d1/share-links`, () => HttpResponse.json(links)));

    const result = await listShareLinks("Document", "d1");

    expect(result).toEqual(links);
  });

  it("listShareLinks throws when the request fails", async () => {
    server.use(
      http.get(`${base}/Document/objects/d1/share-links`, () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(listShareLinks("Document", "d1")).rejects.toMatchObject({ status: 500 });
  });

  it("revokeShareLink deletes a link", async () => {
    let called = false;
    server.use(
      http.delete(`${base}/share-links/l1`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await revokeShareLink("l1");

    expect(called).toBe(true);
  });

  it("revokeShareLink throws when the request fails", async () => {
    server.use(
      http.delete(`${base}/share-links/l1`, () => new HttpResponse(null, { status: 404 })),
    );

    await expect(revokeShareLink("l1")).rejects.toMatchObject({ status: 404 });
  });
});
