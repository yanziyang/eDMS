import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { request, setAccessToken } from "./api-client";

describe("api-client", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once after a 401 and a successful refresh", async () => {
    const calls: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const path = typeof url === "string" ? url : url.toString();
        calls.push(path);

        if (path.endsWith("/auth/refresh")) {
          return jsonResponse({ accessToken: "new-token", expiresInSeconds: 900 });
        }

        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        if (path.endsWith("/documents/1") && auth === "Bearer new-token") {
          return jsonResponse({ id: "1", name: "contract.pdf" });
        }

        return jsonResponse({ title: "Unauthorized" }, 401);
      }),
    );

    const result = await request<{ id: string }>("/documents/1");

    expect(result.id).toBe("1");
    expect(calls.filter((path) => path.endsWith("/documents/1"))).toHaveLength(2);
    expect(calls.some((path) => path.includes("/auth/refresh"))).toBe(true);
  });

  it("throws when refresh fails after a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ title: "Unauthorized" }, 401)),
    );

    await expect(request("/documents/1")).rejects.toMatchObject({ status: 401 });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
