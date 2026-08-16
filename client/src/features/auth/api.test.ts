import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { forgotPassword, login, logout, me, resetPassword } from "./api";

const base = "http://localhost:5080/api/v1";

describe("auth api", () => {
  it("login posts credentials and returns the response", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/auth/login`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ accessToken: "token-1", expiresInSeconds: 900, user: { id: "u1" } });
      }),
    );

    const result = await login("a@b.c", "secret");

    expect(result.accessToken).toBe("token-1");
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("POST");
    await expect(requests[0].json()).resolves.toEqual({ email: "a@b.c", password: "secret" });
  });

  it("logout posts to /auth/logout", async () => {
    let called = false;
    server.use(
      http.post(`${base}/auth/logout`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await logout();

    expect(called).toBe(true);
  });

  it("me fetches the current user", async () => {
    server.use(
      http.get(`${base}/auth/me`, () =>
        HttpResponse.json({ id: "u1", email: "a@b.c", displayName: "A", isSystemAdmin: false, siteMemberships: [] }),
      ),
    );

    const result = await me();

    expect(result.id).toBe("u1");
  });

  it("forgotPassword posts the email", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/auth/forgot-password`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await forgotPassword("a@b.c");

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ email: "a@b.c" });
  });

  it("resetPassword posts email, token and new password", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/auth/reset-password`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await resetPassword("a@b.c", "tok-123", "new-pass");

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ email: "a@b.c", token: "tok-123", newPassword: "new-pass" });
  });
});
