import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { createUser, listUsers, setUserActive } from "./api";

const base = "http://localhost:5080/api/v1";

describe("admin api", () => {
  it("listUsers gets all users", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([{ id: "u1", displayName: "A" }])),
    );

    const result = await listUsers();

    expect(result).toEqual([{ id: "u1", displayName: "A" }]);
  });

  it("listUsers adds an encoded search query", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/users`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listUsers("a b&c");

    expect(urls[0]).toContain("search=a%20b%26c");
  });

  it("createUser posts the user fields", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/users`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("u9", { status: 201 });
      }),
    );

    const id = await createUser({ email: "n@x.c", displayName: "N", tempPassword: "p", isSystemAdmin: true });

    expect(id).toBe("u9");
    await expect(requests[0].json()).resolves.toEqual({ email: "n@x.c", displayName: "N", tempPassword: "p", isSystemAdmin: true });
  });

  it("setUserActive reactivates", async () => {
    const urls: string[] = [];
    server.use(
      http.post(`${base}/users/u1/reactivate`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await setUserActive("u1", true);

    expect(urls[0]).toContain("/users/u1/reactivate");
  });

  it("setUserActive deactivates", async () => {
    const urls: string[] = [];
    server.use(
      http.post(`${base}/users/u1/deactivate`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await setUserActive("u1", false);

    expect(urls[0]).toContain("/users/u1/deactivate");
  });
});
