import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  listGroups,
  removeGroupMember,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("groups api", () => {
  it("listGroups gets all groups", async () => {
    server.use(
      http.get(`${base}/groups`, () => HttpResponse.json([{ id: "g1", name: "Managers" }])),
    );

    const result = await listGroups();

    expect(result).toEqual([{ id: "g1", name: "Managers" }]);
  });

  it("listGroups filters by site id", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/groups`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listGroups("s1");

    expect(urls[0]).toContain("siteId=s1");
  });

  it("addGroupMember posts the member", async () => {
    const urls: string[] = [];
    server.use(
      http.post(`${base}/groups/g1/members/u1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await addGroupMember("g1", "u1");

    expect(urls[0]).toContain("/groups/g1/members/u1");
  });

  it("removeGroupMember deletes the member", async () => {
    const urls: string[] = [];
    server.use(
      http.delete(`${base}/groups/g1/members/u1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await removeGroupMember("g1", "u1");

    expect(urls[0]).toContain("/groups/g1/members/u1");
  });

  it("createGroup posts the group payload", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/groups`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("g9", { status: 201 });
      }),
    );

    const id = await createGroup({ name: "Finance", description: "Money", siteId: null });

    expect(id).toBe("g9");
    await expect(requests[0].json()).resolves.toEqual({
      name: "Finance",
      description: "Money",
      siteId: null,
    });
  });

  it("deleteGroup deletes the group", async () => {
    const urls: string[] = [];
    server.use(
      http.delete(`${base}/groups/g1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteGroup("g1");

    expect(urls[0]).toContain("/groups/g1");
  });
});
