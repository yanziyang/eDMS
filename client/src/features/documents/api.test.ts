import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import {
  checkInDocument,
  checkOutDocument,
  copyDocument,
  createFolder,
  deleteDocument,
  deleteFolder,
  discardCheckout,
  downloadDocument,
  getDocument,
  listDocumentVersions,
  listFolderItems,
  listItems,
  listLibraries,
  moveDocument,
  restoreVersion,
  updateDocument,
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

  it("moveDocument posts the destination", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/documents/d1/move`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("d2");
      }),
    );

    const id = await moveDocument("d1", { destinationLibraryId: "l2", destinationFolderId: null });

    expect(id).toBe("d2");
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      destinationLibraryId: "l2",
      destinationFolderId: null,
    });
  });

  it("copyDocument posts the destination", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/documents/d1/copy`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("d9");
      }),
    );

    const id = await copyDocument("d1", { destinationLibraryId: "l2", destinationFolderId: "f3" });

    expect(id).toBe("d9");
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      destinationLibraryId: "l2",
      destinationFolderId: "f3",
    });
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

  it("getDocument gets a document by id", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json({ id: "d1", name: "a.txt" })),
    );

    const result = await getDocument("d1");

    expect(result).toEqual({ id: "d1", name: "a.txt" });
  });

  it("updateDocument puts the update payload", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/documents/d1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateDocument("d1", { name: "renamed.txt", title: "T", description: "D" });

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ name: "renamed.txt", title: "T", description: "D" });
  });

  it("listDocumentVersions gets the version history", async () => {
    server.use(
      http.get(`${base}/documents/d1/versions`, () =>
        HttpResponse.json([{ id: "v1", versionMajor: 1, versionMinor: 0 }]),
      ),
    );

    const result = await listDocumentVersions("d1");

    expect(result).toEqual([{ id: "v1", versionMajor: 1, versionMinor: 0 }]);
  });

  it("restoreVersion posts the restore action", async () => {
    let called = false;
    server.use(
      http.post(`${base}/documents/d1/versions/v1/restore`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await restoreVersion("d1", "v1");

    expect(called).toBe(true);
  });

  it("checkOutDocument posts the checkout action", async () => {
    let called = false;
    server.use(
      http.post(`${base}/documents/d1/checkout`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await checkOutDocument("d1");

    expect(called).toBe(true);
  });

  it("checkInDocument posts the checkin action with a comment", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/documents/d1/checkin`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await checkInDocument("d1", "Fixed typo");

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ comment: "Fixed typo" });
  });

  it("checkInDocument posts a null comment when none is given", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/documents/d1/checkin`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await checkInDocument("d1");

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ comment: null });
  });

  it("discardCheckout posts the discard action", async () => {
    let called = false;
    server.use(
      http.post(`${base}/documents/d1/discard-checkout`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await discardCheckout("d1");

    expect(called).toBe(true);
  });
});
