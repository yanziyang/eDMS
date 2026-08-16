import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { toast } from "sonner";
import { LibraryBrowser } from "./library";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function item(overrides: Record<string, unknown> = {}) {
  return {
    kind: "document",
    id: "i1",
    name: "contract.pdf",
    sizeBytes: 2048,
    modifiedAt: "2026-03-01T10:00:00Z",
    folderId: null,
    documentId: "d1",
    checkedOutBy: null,
    ...overrides,
  };
}

function renderLibrary(libraryId = "l1", siteSlug = "site-one") {
  return render(
    <MemoryRouter initialEntries={[`/sites/${siteSlug}/libraries/${libraryId}`]}>
      <Routes>
        <Route path="/sites/:siteSlug/libraries/:libraryId" element={<LibraryBrowser />} />
        <Route path="/sites/:siteSlug" element={<div>SITE_HOME</div>} />
        <Route path="/" element={<div>SITES</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LibraryBrowser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists documents and folders with metadata", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item(),
          item({
            kind: "document",
            id: "i2",
            name: "checked.pdf",
            documentId: "d2",
            checkedOutBy: "Alice",
            sizeBytes: 500,
          }),
          item({
            kind: "document",
            id: "i4",
            name: "big.mp4",
            documentId: "d4",
            sizeBytes: 5 * 1024 * 1024,
          }),
          item({
            kind: "folder",
            id: "i3",
            name: "Archived",
            documentId: null,
            folderId: "f3",
            sizeBytes: 0,
          }),
        ]),
      ),
    );

    renderLibrary();

    expect(await screen.findByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("checked.pdf")).toBeInTheDocument();
    expect(screen.getByText("Checked out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archived" })).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("500 B")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "site-one" })).toHaveAttribute("href", "/sites/site-one");
  });

  it("opens the file picker when Upload is clicked", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty.");

    await user.click(screen.getByRole("button", { name: "Upload" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores a file selection with no files", async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    renderLibrary();
    await screen.findByText("This folder is empty.");

    fireEvent.change(fileInput(), { target: { files: [] } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toBe(1);
    expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );

    renderLibrary();

    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
  });

  it("navigates into a folder", async () => {
    const libraryItems = [item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(libraryItems)),
      http.get(`${base}/folders/f3/items`, () =>
        HttpResponse.json([item({ id: "i9", name: "inside.txt", documentId: "d9" })]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Archived" }));

    expect(await screen.findByText("inside.txt")).toBeInTheDocument();
  });

  it("creates a folder at the library root", async () => {
    const items: unknown[] = [];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.post(`${base}/libraries/l1/folders`, async ({ request }) => {
        requests.push(request);
        items.push(item({ kind: "folder", id: "f-new", name: "Team Docs", documentId: null, folderId: "f-new" }));
        return HttpResponse.json("f-new", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.type(await screen.findByPlaceholderText("New folder name"), "  Team Docs  ");
    await user.click(screen.getByRole("button", { name: "New folder" }));

    expect(await screen.findByRole("button", { name: "Team Docs" })).toBeInTheDocument();
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ name: "Team Docs" });
  });

  it("creates a folder inside the current folder", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })]),
      ),
      http.get(`${base}/folders/f3/items`, () => HttpResponse.json([])),
      http.post(`${base}/folders/f3/folders`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("f-sub", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Archived" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "Sub");
    await user.click(screen.getByRole("button", { name: "New folder" }));

    await waitFor(() => expect(requests).toHaveLength(1));
  });

  it("ignores an empty folder name", async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "New folder" }));
    await waitFor(() => expect(calls).toBe(1));

    await user.type(screen.getByPlaceholderText("New folder name"), "   ");
    await user.click(screen.getByRole("button", { name: "New folder" }));

    await waitFor(() => expect(calls).toBe(1));
  });

  it("uploads files at the library root and reports success", async () => {
    const items: unknown[] = [];
    const uploaded: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        void url;
        if ((init?.method ?? "GET") === "GET") {
          return jsonResponse(items);
        }
        const body = init?.body as FormData;
        const file = body.get("file") as File;
        uploaded.push(file.name);
        items.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
        return jsonResponse(
          { documentId: "x", name: file.name, versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" },
          201,
        );
      }),
    );

    renderLibrary();
    await screen.findByText("This folder is empty.");

    fireEvent.change(fileInput(), {
      target: { files: [new File(["a"], "a.txt"), new File(["b"], "b.txt")] },
    });

    expect(await screen.findByText("a.txt")).toBeInTheDocument();
    expect(screen.getByText("b.txt")).toBeInTheDocument();
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded a.txt (v1.0)");
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded b.txt (v1.0)");
    expect(uploaded).toEqual(["a.txt", "b.txt"]);
  });

  it("uploads into the current folder", async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })]),
      ),
      http.get(`${base}/folders/f3/items`, () => HttpResponse.json([])),
      http.post(`${base}/folders/f3/documents`, async ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ documentId: "x", name: "up.txt", versionId: "v1", versionLabel: "2.0", sizeBytes: 3, status: "ok" }, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Archived" }));

    fireEvent.change(fileInput(), { target: { files: [new File(["x"], "up.txt")] } });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded up.txt (v2.0)");
  });

  it("reports a failed upload per file", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/documents`, () => new HttpResponse(null, { status: 500 })),
    );

    renderLibrary();
    await screen.findByText("This folder is empty.");

    fireEvent.change(fileInput(), { target: { files: [new File(["x"], "bad.txt")] } });

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to upload bad.txt"),
    );
  });

  it("downloads a document", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/documents/d1/download`, () =>
        new HttpResponse("pdf-bytes", { headers: { "Content-Type": "application/pdf" } }),
      ),
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:fake");
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Download" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("contract.pdf");
    expect(anchor.href).toBe("blob:fake");
  });

  it("deletes a document and reloads", async () => {
    const items = [item()];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.delete(`${base}/documents/d1`, () => {
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
  });

  it("deletes a folder and reloads", async () => {
    const items = [item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.delete(`${base}/folders/f3`, () => {
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByText("This folder is empty.")).toBeInTheDocument();
  });
});
