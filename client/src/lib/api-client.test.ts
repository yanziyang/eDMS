import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, requestBlob, setAccessToken } from "./api-client";

describe("api-client", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("throws when refresh fails with a network error", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const path = typeof url === "string" ? url : url.toString();
        calls.push(path);
        if (path.endsWith("/auth/refresh")) {
          throw new TypeError("network down");
        }
        return jsonResponse({ title: "Unauthorized" }, 401);
      }),
    );

    const error = (await request("/documents/1").catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(calls.filter((p) => p.includes("/auth/refresh"))).toHaveLength(1);
    expect(calls.filter((p) => p.endsWith("/documents/1"))).toHaveLength(1);
  });

  it("returns undefined for 204 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );

    await expect(request<void>("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("does not attach a content-type header for FormData bodies", async () => {
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = init;
        return jsonResponse({ ok: true });
      }),
    );

    const form = new FormData();
    form.append("file", new Blob(["x"]), "a.txt");
    await request("/upload", { method: "POST", body: form });

    const headers = (captured?.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("attaches the bearer token when set", async () => {
    setAccessToken("tok-1");
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = init;
        return jsonResponse({ ok: true });
      }),
    );

    await request("/documents/1");

    const headers = (captured?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-1");
  });

  it("does not attempt a refresh for login-family endpoints", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        calls.push(typeof url === "string" ? url : url.toString());
        return jsonResponse({ title: "Bad credentials" }, 401);
      }),
    );

    await expect(request("/auth/login", { method: "POST" })).rejects.toMatchObject({ status: 401 });
    expect(calls.some((path) => path.includes("/auth/refresh"))).toBe(false);
  });

  it("builds an ApiError from a non-JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 502, statusText: "Bad Gateway" })),
    );

    const error = (await request("/documents/1").catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).toBe("Bad Gateway");
  });

  it("falls back to a generic message when the problem has no title or detail", () => {
    const error = new ApiError(500, {});

    expect(error.message).toBe("Request failed");
    expect(error.status).toBe(500);
    expect(error.name).toBe("ApiError");
  });

  it("uses the problem detail when title is missing", async () => {
    const error = await ApiError.fromResponse(
      new Response(JSON.stringify({ detail: "Something broke" }), { status: 400, statusText: "" }),
    );

    expect(error.message).toBe("Something broke");
  });

  it("requestBlob returns a blob", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("bytes", { headers: { "Content-Type": "application/pdf" } })),
    );

    const blob = await requestBlob("/documents/1/download");

    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe("bytes");
  });

  it("requestBlob attaches the bearer token when set", async () => {
    setAccessToken("tok-blob");
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = init;
        return new Response("bytes");
      }),
    );

    await requestBlob("/documents/1/download");

    const headers = (captured?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-blob");
  });

  it("requestBlob refreshes and retries on 401", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const path = typeof url === "string" ? url : url.toString();
        calls.push(path);
        if (path.endsWith("/auth/refresh")) {
          return jsonResponse({ accessToken: "tok-2", expiresInSeconds: 900 });
        }
        if (path.endsWith("/download") && calls.filter((p) => p.endsWith("/download")).length > 1) {
          return new Response("data");
        }
        return jsonResponse({ title: "Unauthorized" }, 401);
      }),
    );

    const blob = await requestBlob("/documents/1/download");

    await expect(blob.text()).resolves.toBe("data");
    expect(calls.filter((p) => p.endsWith("/download"))).toHaveLength(2);
  });

  it("requestBlob throws when refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const path = typeof url === "string" ? url : url.toString();
        if (path.endsWith("/auth/refresh")) {
          return jsonResponse({ title: "Unauthorized" }, 401);
        }
        return jsonResponse({ title: "Unauthorized" }, 401);
      }),
    );

    await expect(requestBlob("/documents/1/download")).rejects.toMatchObject({ status: 401 });
  });

  it("requestBlob throws an ApiError for non-401 failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ title: "Not found" }, 404)),
    );

    await expect(requestBlob("/documents/1/download")).rejects.toMatchObject({ status: 404 });
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
