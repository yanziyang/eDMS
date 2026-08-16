import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
  createFolder,
  deleteDocument,
  deleteFolder,
  downloadDocument,
  listFolderItems,
  listItems,
  listLibraries,
  uploadToFolder,
  uploadToLibrary,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("documents api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("listLibraries gets libraries for a site", async () => {
    server.use(
      http.get(`${base}/sites/s1/libraries`, () => HttpResponse.json([{ id: "l1", name: "Lib" }])),
    );

    const result = await listLibraries("s1");

    expect(result).toEqual([{ id: "l1", name: "Lib" }]);
  });

  it("listItems gets items for a library", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([{ id: "i1", kind: "document" }])),
    );

    const result = await listItems("l1");

    expect(result).toEqual([{ id: "i1", kind: "document" }]);
  });

  it("listFolderItems gets items for a folder", async () => {
    server.use(
      http.get(`${base}/folders/f1/items`, () => HttpResponse.json([{ id: "i2", kind: "folder" }])),
    );

    const result = await listFolderItems("f1");

    expect(result).toEqual([{ id: "i2", kind: "folder" }]);
  });

  it("uploadToLibrary posts multipart form data", async () => {
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        captured = init;
        return new Response(JSON.stringify({ documentId: "d1", name: "a.txt", versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const file = new File(["abc"], "a.txt", { type: "text/plain" });
    const result = await uploadToLibrary("l1", file);

    expect(result.versionLabel).toBe("1.0");
    const form = captured?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get("file") as File).name).toBe("a.txt");
    const headers = (captured?.headers ?? {}) as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("uploadToFolder posts to the folder endpoint", async () => {
    const urls: string[] = [];
    let captured: RequestInit | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        urls.push(String(url));
        captured = init;
        return new Response(JSON.stringify({ documentId: "d2", name: "b.txt", versionId: "v2", versionLabel: "1.0", sizeBytes: 3, status: "ok" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const file = new File(["abc"], "b.txt", { type: "text/plain" });
    const result = await uploadToFolder("f1", file);

    expect(result.documentId).toBe("d2");
    expect(urls[0]).toContain("/folders/f1/documents");
    expect((captured?.body as FormData).get("file")).toBe(file);
  });

  it("createFolder posts under a library when no parent folder", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/libraries/l1/folders`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("f1", { status: 201 });
      }),
    );

    const id = await createFolder("l1", null, "Docs");

    expect(id).toBe("f1");
    await expect(requests[0].json()).resolves.toEqual({ name: "Docs" });
  });

  it("createFolder posts under the parent folder", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/folders/f1/folders`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("f2", { status: 201 });
      }),
    );

    const id = await createFolder(null, "f1", "Sub");

    expect(id).toBe("f2");
    expect(requests).toHaveLength(1);
  });

  it("deleteDocument deletes the document", async () => {
    let called = false;
    server.use(
      http.delete(`${base}/documents/d1`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteDocument("d1");

    expect(called).toBe(true);
  });

  it("deleteFolder deletes the folder", async () => {
    let called = false;
    server.use(
      http.delete(`${base}/folders/f1`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteFolder("f1");

    expect(called).toBe(true);
  });

  it("downloadDocument fetches the blob and triggers an anchor download", async () => {
    server.use(
      http.get(`${base}/documents/d1/download`, () =>
        new HttpResponse("file-bytes", { headers: { "Content-Type": "application/octet-stream" } }),
      ),
    );

    const createObjectURL = vi.fn((_blob: Blob) => "blob:fake-url");
    const revokeObjectURL = vi.fn((_url: string) => {});
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadDocument("d1", "report.pdf");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe("file-bytes");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});
