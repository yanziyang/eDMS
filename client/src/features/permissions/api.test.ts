import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  getPermissions,
  grantPermission,
  resetPermissions,
  revokePermission,
  share,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("permissions api", () => {
  it("getPermissions gets the permission state for an object", async () => {
    server.use(
      http.get(`${base}/Document/objects/d1/permissions`, () =>
        HttpResponse.json({ hasUniqueAcl: true, entries: [] }),
      ),
    );

    const result = await getPermissions("Document", "d1");

    expect(result).toEqual({ hasUniqueAcl: true, entries: [] });
  });

  it("grantPermission posts a new permission entry", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/Document/objects/d1/permissions`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await grantPermission("Document", "d1", {
      principalType: "Group",
      principalId: "g1",
      level: "Contribute",
    });

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      principalType: "Group",
      principalId: "g1",
      level: "Contribute",
    });
  });

  it("revokePermission deletes a permission entry", async () => {
    let called = false;
    server.use(
      http.delete(`${base}/Document/objects/d1/permissions/User/u2`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await revokePermission("Document", "d1", "User", "u2");

    expect(called).toBe(true);
  });

  it("resetPermissions resets to inherited permissions", async () => {
    let called = false;
    server.use(
      http.post(`${base}/Document/objects/d1/permissions/reset`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await resetPermissions("Document", "d1");

    expect(called).toBe(true);
  });

  it("share posts a share request for a principal", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/Document/objects/d1/share`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await share("Document", "d1", { principalId: "u2", level: "Read" });

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ principalId: "u2", level: "Read" });
  });
});
