import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { server } from "@/test/server";
import { toast } from "sonner";
import { LibraryBrowser } from "./library";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/uploads/chunkedUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/uploads/chunkedUpload")>();
  return { ...actual, LARGE_FILE_THRESHOLD: 3 };
});

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
  }),
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

function site(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Site One",
    description: null,
    urlSlug: "site-one",
    storageQuotaBytes: null,
    storageUsedBytes: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function library(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    siteId: "s1",
    name: "Policies",
    description: null,
    enableVersioning: true,
    enableMinorVersions: false,
    requireCheckout: false,
    minorVersionsRetained: null,
    ...overrides,
  };
}

function mockNav(overrides: { sites?: unknown; libraries?: unknown } = {}) {
  server.use(
    http.get(`${base}/sites`, () => HttpResponse.json(overrides.sites ?? [site()])),
    http.get(`${base}/sites/s1/libraries`, () =>
      HttpResponse.json(overrides.libraries ?? [library(), library({ id: "l2", name: "Finance" })]),
    ),
    http.get(`${base}/admin/content-types`, () => HttpResponse.json([])),
  );
}

function renderLibrary(libraryId = "l1", siteSlug = "site-one") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/sites/${siteSlug}/libraries/${libraryId}`]}>
          <Routes>
            <Route path="/sites/:siteSlug/libraries/:libraryId" element={<LibraryBrowser />} />
            <Route path="/sites/:siteSlug" element={<div>SITE_HOME</div>} />
            <Route path="/" element={<div>SITES</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
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

function stubUploadFetch(
  libraryItems: unknown[],
  folderItems: unknown[],
  uploaded: string[],
  postHandler: (path: string, file: File, metadata: unknown) => Response,
  contentType: unknown = null,
  contentTypesStatus = 200,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const path = String(url);
      if ((init?.method ?? "GET") === "GET") {
        if (path.endsWith("/sites")) return jsonResponse([site()]);
        if (path.endsWith("/sites/s1/libraries")) {
          return jsonResponse([library(), library({ id: "l2", name: "Finance" })]);
        }
        if (path.includes("/libraries/l1/items")) return jsonResponse(libraryItems);
        if (path.includes("/folders/f3/items")) return jsonResponse(folderItems);
        if (path.includes("/admin/content-types")) {
          if (contentTypesStatus === 403) return new Response(null, { status: 403 });
          return jsonResponse(contentType ? [contentType] : []);
        }
        return jsonResponse([]);
      }
      const body = init?.body as FormData;
      const file = body.get("file") as File;
      let metadata: unknown = null;
      const rawMetadata = body.get("metadata");
      if (typeof rawMetadata === "string" && rawMetadata !== "") {
        metadata = JSON.parse(rawMetadata);
      }
      uploaded.push(file.name);
      return postHandler(path, file, metadata);
    }),
  );
}

function itemNameRows(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).queryAllByRole("button")[0]?.textContent ?? "");
}

function chunkedSessionDto(sessionId: string, s: { uploadedBytes: number; totalBytes: number; fileName: string }, chunkSize: number) {
  return {
    sessionId,
    fileName: s.fileName,
    totalBytes: s.totalBytes,
    uploadedBytes: s.uploadedBytes,
    chunkSize,
    expiresAt: "2026-09-01T00:00:00Z",
  };
}

function mockChunkedFlow(options: {
  chunkSize?: number;
  contentType?: unknown;
  failChunks?: number[];
  hangFirstChunk?: boolean;
  failStart?: boolean;
} = {}) {
  const chunkSize = options.chunkSize ?? 100;
  const state = {
    starts: 0,
    startsBody: [] as unknown[],
    statusChecks: 0,
    chunkRequests: [] as { sessionId: string; offset: number; bytes: number }[],
    completions: [] as { sessionId: string; body: unknown }[],
    aborts: [] as string[],
    releaseFirstChunk: null as null | (() => void),
    libraryItems: [] as unknown[],
  };
  const sessions = new Map<string, { uploadedBytes: number; totalBytes: number; fileName: string; metadata: unknown }>();
  const failedOffsets = new Set<string>();
  let firstChunkHeld = false;

  server.use(
    http.get(`${base}/sites`, () => HttpResponse.json([site()])),
    http.get(`${base}/sites/s1/libraries`, () =>
      HttpResponse.json([library(), library({ id: "l2", name: "Finance" })]),
    ),
    http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(state.libraryItems)),
    http.get(`${base}/admin/content-types`, () =>
      HttpResponse.json(options.contentType ? [options.contentType] : []),
    ),
    http.post(`${base}/uploads`, async ({ request }) => {
      if (options.failStart) {
        return new HttpResponse(null, { status: 500 });
      }
      state.starts += 1;
      const body = (await request.json()) as { fileName: string; totalBytes: number; metadata: unknown };
      state.startsBody.push(body);
      const sessionId = `s${state.starts}`;
      sessions.set(sessionId, {
        uploadedBytes: 0,
        totalBytes: body.totalBytes,
        fileName: body.fileName,
        metadata: body.metadata,
      });
      return HttpResponse.json(chunkedSessionDto(sessionId, sessions.get(sessionId)!, chunkSize), { status: 201 });
    }),
    http.get(`${base}/uploads/:sessionId`, ({ params }) => {
      state.statusChecks += 1;
      return HttpResponse.json(chunkedSessionDto(String(params.sessionId), sessions.get(String(params.sessionId))!, chunkSize));
    }),
    http.put(`${base}/uploads/:sessionId/chunks`, async ({ request, params }) => {
      const sessionId = String(params.sessionId);
      const offset = Number(new URL(request.url).searchParams.get("offset"));
      const s = sessions.get(sessionId)!;
      const key = `${sessionId}:${offset}`;
      if (options.failChunks?.includes(offset) && !failedOffsets.has(key)) {
        failedOffsets.add(key);
        return HttpResponse.json({ title: "Conflict", detail: "Offset mismatch" }, { status: 409 });
      }
      if (offset !== s.uploadedBytes) {
        return HttpResponse.json({ title: "Conflict", detail: "Offset mismatch" }, { status: 409 });
      }
      const body = await request.arrayBuffer();
      state.chunkRequests.push({ sessionId, offset, bytes: body.byteLength });
      s.uploadedBytes = Math.min(s.uploadedBytes + body.byteLength, s.totalBytes);
      const response = HttpResponse.json(chunkedSessionDto(sessionId, s, chunkSize));
      if (options.hangFirstChunk && !firstChunkHeld) {
        firstChunkHeld = true;
        return new Promise<Response>((resolve) => {
          state.releaseFirstChunk = () => resolve(response);
        });
      }
      return response;
    }),
    http.post(`${base}/uploads/:sessionId/complete`, async ({ request, params }) => {
      const sessionId = String(params.sessionId);
      state.completions.push({ sessionId, body: await request.json() });
      const s = sessions.get(sessionId)!;
      state.libraryItems.push(item({ id: "d-big", name: s.fileName, documentId: "d-big", sizeBytes: s.totalBytes }));
      return HttpResponse.json(
        { documentId: "d-big", name: s.fileName, versionId: "v1", versionLabel: "1.0", sizeBytes: s.totalBytes, status: "ok" },
        { status: 201 },
      );
    }),
    http.delete(`${base}/uploads/:sessionId`, ({ params }) => {
      state.aborts.push(String(params.sessionId));
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return state;
}

async function openUploadDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Upload" }));
  await screen.findByText("Upload files");
  return user;
}

describe("LibraryBrowser", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists documents and folders with metadata", async () => {
    mockNav();
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
    expect(screen.getByRole("link", { name: "Site One" })).toHaveAttribute(
      "href",
      "/sites/site-one",
    );
    expect(await screen.findByRole("heading", { name: "Policies" })).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );

    renderLibrary();

    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
  });

  it("shows an error when items fail to load", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => new HttpResponse(null, { status: 500 })),
    );

    renderLibrary();

    expect(await screen.findByText("Failed to load items.")).toBeInTheDocument();
  });

  it("navigates into a folder and back via the breadcrumb", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })]),
      ),
      http.get(`${base}/folders/f3/items`, () =>
        HttpResponse.json([item({ id: "i9", name: "inside.txt", documentId: "d9" })]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Archived" }));

    expect(await screen.findByText("inside.txt")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Policies" }));

    expect(await screen.findByRole("button", { name: "Archived" })).toBeInTheDocument();
  });

  it("creates a folder at the library root", async () => {
    mockNav();
    const items: unknown[] = [];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.post(`${base}/libraries/l1/folders`, async ({ request }) => {
        requests.push(request);
        items.push(
          item({ kind: "folder", id: "f-new", name: "Team Docs", documentId: null, folderId: "f-new" }),
        );
        return HttpResponse.json("f-new", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "  Team Docs  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("button", { name: "Team Docs" })).toBeInTheDocument();
    expect(mockedToast.success).toHaveBeenCalledWith("Folder created");
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ name: "Team Docs" });
  });

  it("creates a folder inside the current folder", async () => {
    mockNav();
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
    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "Sub");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({ name: "Sub" });
  });

  it("reports a failed folder creation", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/folders`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "Nope");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to create folder"));
  });

  it("shows a pending state while creating a folder", async () => {
    mockNav();
    let resolveCreate!: (response: Response) => void;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/folders`, () => new Promise<Response>((resolve) => {
        resolveCreate = resolve;
      })),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "Slow");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolveCreate(HttpResponse.json("f-slow", { status: 201 }));
  });

  it("cancels the create folder dialog", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/folders`, () => {
        posts += 1;
        return HttpResponse.json("f", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    await waitFor(() => expect(posts).toBe(0));
  });

  it("does not submit an empty folder name", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/folders`, () => {
        posts += 1;
        return HttpResponse.json("f", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    const createButton = await screen.findByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("uploads files at the library root and reports success", async () => {
    const items: unknown[] = [];
    const uploaded: string[] = [];
    stubUploadFetch(items, [], uploaded, (_path, file) => {
      items.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
      return jsonResponse(
        { documentId: "x", name: file.name, versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" },
        201,
      );
    });

    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

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
    const folderItems: unknown[] = [];
    const libraryItems: unknown[] = [
      item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" }),
    ];
    const posts: string[] = [];
    stubUploadFetch(libraryItems, folderItems, [], (path, file) => {
      posts.push(path);
      folderItems.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
      return jsonResponse(
        { documentId: "x", name: file.name, versionId: "v1", versionLabel: "2.0", sizeBytes: 3, status: "ok" },
        201,
      );
    });

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Archived" }));
    await openUploadDialog();
    fireEvent.change(fileInput(), { target: { files: [new File(["x"], "up.txt")] } });

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toContain("/folders/f3/documents");
    expect(await screen.findByText("up.txt")).toBeInTheDocument();
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded up.txt (v2.0)");
  });

  it("reports a failed upload per file", async () => {
    const uploaded: string[] = [];
    stubUploadFetch([], [], uploaded, () => new Response(null, { status: 500 }));

    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), { target: { files: [new File(["x"], "bad.txt")] } });

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to upload bad.txt"));
    expect(uploaded).toEqual(["bad.txt"]);
  });

  it("uploads a large file via the chunked flow and lists it on success", async () => {
    const flow = mockChunkedFlow({ chunkSize: 100 });

    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Uploaded big.bin (v1.0)"));
    expect(flow.starts).toBe(1);
    expect(flow.startsBody[0]).toMatchObject({
      libraryId: "l1",
      folderId: null,
      fileName: "big.bin",
      totalBytes: 250,
    });
    expect(flow.chunkRequests.map((c) => c.offset)).toEqual([0, 100, 200]);
    expect(flow.chunkRequests.map((c) => c.bytes)).toEqual([100, 100, 50]);
    expect(flow.completions).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "big.bin" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Upload files")).not.toBeInTheDocument());
  });

  it("shows a resume button after a failed chunk and resumes from the reported offset", async () => {
    const flow = mockChunkedFlow({ chunkSize: 100, failChunks: [100] });

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(flow.chunkRequests).toEqual([{ sessionId: "s1", offset: 0, bytes: 100 }]);
    expect(screen.getByText("100 B / 250 B")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Upload failed: Offset mismatch")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Uploaded big.bin (v1.0)"));
    expect(flow.statusChecks).toBe(2);
    expect(flow.chunkRequests.map((c) => c.offset)).toEqual([0, 100, 200]);
    expect(flow.completions).toHaveLength(1);
    expect(await screen.findByRole("button", { name: "big.bin" })).toBeInTheDocument();
  });

  it("aborts the session when canceling after a failed chunk", async () => {
    const flow = mockChunkedFlow({ chunkSize: 100, failChunks: [0] });

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    expect(await screen.findByRole("button", { name: "Resume" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(flow.aborts).toEqual(["s1"]));
    await waitFor(() => expect(screen.queryByText("Upload files")).not.toBeInTheDocument());
    expect(mockedToast.success).not.toHaveBeenCalled();
  });

  it("disables cancel and ignores close while chunks are uploading", async () => {
    const flow = mockChunkedFlow({ chunkSize: 100, hangFirstChunk: true });

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    await waitFor(() => expect(flow.chunkRequests).toHaveLength(1));
    expect(screen.getByText("0 B / 250 B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Upload files")).toBeInTheDocument();

    flow.releaseFirstChunk!();

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Uploaded big.bin (v1.0)"));
    expect(await screen.findByRole("button", { name: "big.bin" })).toBeInTheDocument();
  });

  it("passes metadata to start and complete for chunked uploads", async () => {
    const contentType = {
      id: "ct1",
      libraryId: "l1",
      name: "Invoice",
      description: null,
      columns: [
        {
          id: "col1",
          name: "Vendor",
          dataType: "Text",
          isRequired: true,
          choiceOptions: null,
          defaultValue: null,
        },
      ],
    };
    const flow = mockChunkedFlow({ chunkSize: 100, contentType });

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "Upload" }));
    await screen.findByText("Upload files");
    await user.type(screen.getByLabelText("Vendor *"), "Acme");

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Uploaded big.bin (v1.0)"));
    expect(flow.startsBody[0]).toMatchObject({
      metadata: [{ columnDefinitionId: "col1", value: "Acme" }],
    });
    expect(flow.completions[0].body).toEqual({
      metadata: [{ columnDefinitionId: "col1", value: "Acme" }],
    });
  });

  it("shows an error without a resume button when starting the session fails", async () => {
    const flow = mockChunkedFlow({ chunkSize: 100, failStart: true });

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), {
      target: { files: [new File([new Uint8Array(250).fill(7)], "big.bin")] },
    });

    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Upload files")).not.toBeInTheDocument());
    expect(flow.starts).toBe(0);
    expect(flow.aborts).toEqual([]);
    expect(mockedToast.success).not.toHaveBeenCalled();
  });

  it("ignores an empty file selection", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
      http.post(`${base}/libraries/l1/documents`, () => {
        posts += 1;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), { target: { files: [] } });

    await waitFor(() => expect(posts).toBe(0));
  });

  it("cancels the upload dialog", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByText("Upload files")).not.toBeInTheDocument());
  });

  it("shows required metadata fields and sends them with the upload", async () => {
    const items: unknown[] = [];
    const postedMetadata: unknown[] = [];
    const contentType = {
      id: "ct1",
      libraryId: "l1",
      name: "Invoice",
      description: null,
      columns: [
        {
          id: "col1",
          name: "Vendor",
          dataType: "Text",
          isRequired: true,
          choiceOptions: null,
          defaultValue: null,
        },
        {
          id: "col2",
          name: "Approved",
          dataType: "Boolean",
          isRequired: false,
          choiceOptions: null,
          defaultValue: null,
        },
      ],
    };
    stubUploadFetch(items, [], [], (_path, file, metadata) => {
      postedMetadata.push(metadata);
      items.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
      return jsonResponse(
        { documentId: "x", name: file.name, versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" },
        201,
      );
    }, contentType);

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "Upload" }));
    await screen.findByText("Upload files");

    expect(screen.getByText("Metadata")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Vendor *"), "Acme");
    await user.click(screen.getByRole("checkbox", { name: "Approved" }));

    fireEvent.change(fileInput(), { target: { files: [new File(["a"], "a.txt")] } });

    await waitFor(() => expect(postedMetadata).toHaveLength(1));
    expect(postedMetadata[0]).toEqual([
      { columnDefinitionId: "col1", value: "Acme" },
      { columnDefinitionId: "col2", value: "true" },
    ]);
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded a.txt (v1.0)");
  });

  it("prefills metadata defaults and hides inputs when the fetch fails with 403", async () => {
    const items: unknown[] = [];
    const postedMetadata: unknown[] = [];
    const contentType = {
      id: "ct1",
      libraryId: "l1",
      name: "Invoice",
      description: null,
      columns: [
        {
          id: "col1",
          name: "Vendor",
          dataType: "Text",
          isRequired: true,
          choiceOptions: null,
          defaultValue: "Acme",
        },
      ],
    };
    stubUploadFetch(items, [], [], (_path, file, metadata) => {
      postedMetadata.push(metadata);
      items.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
      return jsonResponse(
        { documentId: "x", name: file.name, versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" },
        201,
      );
    }, contentType, 403);

    renderLibrary();
    await screen.findByText("This folder is empty");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Upload" }));
    await screen.findByText("Upload files");

    expect(screen.queryByText("Metadata")).not.toBeInTheDocument();

    fireEvent.change(fileInput(), { target: { files: [new File(["a"], "a.txt")] } });

    await waitFor(() => expect(postedMetadata).toHaveLength(1));
    expect(postedMetadata[0]).toBeNull();
    expect(mockedToast.success).toHaveBeenCalledWith("Uploaded a.txt (v1.0)");
  });

  it("sends prefilled metadata defaults on upload", async () => {
    const items: unknown[] = [];
    const postedMetadata: unknown[] = [];
    const contentType = {
      id: "ct1",
      libraryId: "l1",
      name: "Invoice",
      description: null,
      columns: [
        {
          id: "col1",
          name: "Vendor",
          dataType: "Text",
          isRequired: true,
          choiceOptions: null,
          defaultValue: "Acme",
        },
        {
          id: "col2",
          name: "Approved",
          dataType: "Boolean",
          isRequired: false,
          choiceOptions: null,
          defaultValue: "true",
        },
      ],
    };
    stubUploadFetch(items, [], [], (_path, file, metadata) => {
      postedMetadata.push(metadata);
      items.push(item({ id: `d-${file.name}`, name: file.name, documentId: `d-${file.name}` }));
      return jsonResponse(
        { documentId: "x", name: file.name, versionId: "v1", versionLabel: "1.0", sizeBytes: 3, status: "ok" },
        201,
      );
    }, contentType);

    renderLibrary();
    await screen.findByText("This folder is empty");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Upload" }));
    await screen.findByText("Upload files");

    expect(screen.getByLabelText("Vendor *")).toHaveValue("Acme");
    expect(screen.getByRole("checkbox", { name: "Approved" })).toBeChecked();

    fireEvent.change(fileInput(), { target: { files: [new File(["a"], "a.txt")] } });

    await waitFor(() => expect(postedMetadata).toHaveLength(1));
    expect(postedMetadata[0]).toEqual([
      { columnDefinitionId: "col1", value: "Acme" },
      { columnDefinitionId: "col2", value: "true" },
    ]);
  });

  it("shows the server's 409 detail message in the upload error toast", async () => {
    const uploaded: string[] = [];
    stubUploadFetch([], [], uploaded, () =>
      new Response(
        JSON.stringify({ title: "Missing metadata", detail: "Vendor is required for this library." }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );

    renderLibrary();
    await screen.findByText("This folder is empty");
    await openUploadDialog();

    fireEvent.change(fileInput(), { target: { files: [new File(["x"], "bad.txt")] } });

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(
        "Failed to upload bad.txt: Vendor is required for this library.",
      ),
    );
    expect(uploaded).toEqual(["bad.txt"]);
  });

  it("renders gigabyte sizes", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item({ id: "i5", name: "huge.bin", documentId: "d5", sizeBytes: 3 * 1024 * 1024 * 1024 })]),
      ),
    );

    renderLibrary();

    expect(await screen.findByText("3.0 GB")).toBeInTheDocument();
  });

  it("sorts items by size, name and date", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item({ id: "i1", name: "contract.pdf", sizeBytes: 2048, modifiedAt: "2026-03-01T10:00:00Z" }),
          item({ id: "i2", name: "apple.pdf", documentId: "d2", sizeBytes: 100, modifiedAt: "2026-01-01T10:00:00Z" }),
          item({ id: "i3", name: "big.mp4", documentId: "d3", sizeBytes: 5 * 1024 * 1024, modifiedAt: "2026-05-01T10:00:00Z" }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    expect(itemNameRows()).toEqual(["apple.pdf", "big.mp4", "contract.pdf"]);

    await user.click(screen.getByRole("combobox", { name: "Sort items" }));
    await user.click(await screen.findByRole("option", { name: "Size (largest first)" }));
    expect(itemNameRows()).toEqual(["big.mp4", "contract.pdf", "apple.pdf"]);

    await user.click(screen.getByRole("combobox", { name: "Sort items" }));
    await user.click(await screen.findByRole("option", { name: "Newest first" }));
    expect(itemNameRows()).toEqual(["big.mp4", "contract.pdf", "apple.pdf"]);

    await user.click(screen.getByRole("combobox", { name: "Sort items" }));
    await user.click(await screen.findByRole("option", { name: "Oldest first" }));
    expect(itemNameRows()).toEqual(["apple.pdf", "contract.pdf", "big.mp4"]);
  });

  it("switches to grid view", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item(),
          item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Grid view" }));

    expect(screen.getByRole("button", { name: "Archived" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "contract.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List view" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("navigates into a folder from the grid view", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" })]),
      ),
      http.get(`${base}/folders/f3/items`, () =>
        HttpResponse.json([item({ id: "i9", name: "inside.txt", documentId: "d9" })]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByRole("button", { name: "Archived" });

    await user.click(screen.getByRole("button", { name: "Grid view" }));
    await user.click(screen.getByRole("button", { name: "Archived" }));

    expect(await screen.findByText("inside.txt")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("opens the details sheet from a grid card", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/documents/d1`, () =>
        HttpResponse.json({
          id: "d1",
          libraryId: "l1",
          folderId: null,
          name: "contract.pdf",
          title: null,
          description: null,
          contentType: "application/pdf",
          sizeBytes: 2048,
          checkedOutBy: null,
          checkedOutAt: null,
          createdAt: "2026-03-01T10:00:00Z",
          modifiedAt: "2026-03-01T10:00:00Z",
          versionLabel: "1.0",
        }),
      ),
      http.get(`${base}/documents/d1/metadata`, () =>
        HttpResponse.json({ contentTypeId: null, contentTypeName: null, columns: [] }),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Grid view" }));
    await user.click(screen.getByRole("button", { name: "contract.pdf" }));

    expect(await screen.findByText("File type")).toBeInTheDocument();
  });

  it("sorts via the column headers", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item({ id: "i1", name: "apple.pdf", sizeBytes: 100 }),
          item({ id: "i2", name: "banana.pdf", documentId: "d2", sizeBytes: 500 }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("apple.pdf");

    expect(itemNameRows()).toEqual(["apple.pdf", "banana.pdf"]);

    await user.click(screen.getByRole("button", { name: "Sort by name" }));
    expect(itemNameRows()).toEqual(["banana.pdf", "apple.pdf"]);

    await user.click(screen.getByRole("button", { name: "Sort by name" }));
    expect(itemNameRows()).toEqual(["apple.pdf", "banana.pdf"]);

    await user.click(screen.getByRole("button", { name: "Sort by size" }));
    expect(itemNameRows()).toEqual(["apple.pdf", "banana.pdf"]);

    await user.click(screen.getByRole("button", { name: "Sort by size" }));
    expect(itemNameRows()).toEqual(["banana.pdf", "apple.pdf"]);
  });

  it("clears the folder name when the dialog is closed with X", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("This folder is empty");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(await screen.findByPlaceholderText("New folder name"), "Draft");
    await user.click(screen.getByRole("button", { name: "Close" }));

    await user.click(screen.getByRole("button", { name: "New folder" }));

    expect(await screen.findByPlaceholderText("New folder name")).toHaveValue("");
  });

  it("selects items and bulk deletes documents and folders", async () => {
    mockNav();
    const items: unknown[] = [
      item(),
      item({ id: "i3", kind: "folder", name: "Archived", documentId: null, folderId: "f3" }),
    ];
    const deleted: string[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.delete(`${base}/documents/d1`, ({ request }) => {
        deleted.push(request.url);
        items.splice(0, 1);
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${base}/folders/f3`, ({ request }) => {
        deleted.push(request.url);
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Archived" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toHaveLength(2));
    expect(deleted.some((url) => url.includes("/documents/d1"))).toBe(true);
    expect(deleted.some((url) => url.includes("/folders/f3"))).toBe(true);
    expect(mockedToast.success).toHaveBeenCalledWith("Deleted 2 items");
    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("selects all items and clears the selection", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item(), item({ id: "i2", name: "b.txt", documentId: "d2" })]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select all" }));

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select contract.pdf" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select contract.pdf" })).not.toBeChecked();
  });

  it("shows Move / Copy only when a single document is selected", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item(),
          item({ id: "i2", name: "b.txt", documentId: "d2" }),
          item({ id: "i3", kind: "folder", name: "Archived", documentId: null, folderId: "f3" }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    expect(screen.queryByRole("button", { name: "Move / Copy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    expect(screen.getByRole("button", { name: "Move / Copy" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select b.txt" }));
    expect(screen.queryByRole("button", { name: "Move / Copy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select Archived" }));
    expect(screen.queryByRole("button", { name: "Move / Copy" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select Archived" }));
    await user.click(screen.getByRole("checkbox", { name: "Select b.txt" }));
    expect(screen.getByRole("button", { name: "Move / Copy" })).toBeInTheDocument();
  });

  it("moves a document to another library and folder", async () => {
    mockNav();
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/libraries/l2/items`, () =>
        HttpResponse.json([item({ kind: "folder", id: "f9", name: "2026", documentId: null, folderId: "f9" })]),
      ),
      http.post(`${base}/documents/d1/move`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("d1");
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    await user.click(screen.getByRole("combobox", { name: "Destination library" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await user.click(screen.getByRole("combobox", { name: "Destination folder" }));
    await user.click(await screen.findByRole("option", { name: "2026" }));
    await user.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      destinationLibraryId: "l2",
      destinationFolderId: "f9",
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Document moved");
  });

  it("copies a document to a library root", async () => {
    mockNav();
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/libraries/l2/items`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/copy`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("d9");
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    await user.click(screen.getByRole("combobox", { name: "Destination library" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      destinationLibraryId: "l2",
      destinationFolderId: null,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Document copied");
  });

  it("disables Move and Copy until a destination library is picked", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.post(`${base}/documents/d1/move`, () => {
        posts += 1;
        return HttpResponse.json("d1");
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    const moveButton = screen.getByRole("button", { name: "Move" });
    expect(moveButton).toBeDisabled();
    fireEvent.click(moveButton);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("cancels the move dialog without calling the API", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.post(`${base}/documents/d1/move`, () => {
        posts += 1;
        return HttpResponse.json("d1");
      }),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText('Move or copy "contract.pdf"')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(posts).toBe(0));
  });

  it("closes the move dialog with the X button", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() =>
      expect(screen.queryByText('Move or copy "contract.pdf"')).not.toBeInTheDocument(),
    );
  });

  it("shows an error when destination folders fail to load", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/libraries/l2/items`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');

    await user.click(screen.getByRole("combobox", { name: "Destination library" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));

    expect(await screen.findByText("Failed to load folders.")).toBeInTheDocument();
  });

  it("reports a failed move", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/libraries/l2/items`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/move`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("button", { name: "Move / Copy" }));
    await screen.findByText('Move or copy "contract.pdf"');
    await user.click(screen.getByRole("combobox", { name: "Destination library" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await user.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to move document"));
  });

  it("reports a failed bulk delete", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([item(), item({ id: "i2", name: "b.txt", documentId: "d2" })]),
      ),
      http.delete(`${base}/documents/d1`, () => new HttpResponse(null, { status: 500 })),
      http.delete(`${base}/documents/d2`, () => new HttpResponse(null, { status: 204 })),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));
    await user.click(screen.getByRole("checkbox", { name: "Select b.txt" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete selected items"),
    );
  });

  it("sorts by modified date via the header", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([
          item({ id: "i1", name: "new.txt", modifiedAt: "2026-05-01T10:00:00Z" }),
          item({ id: "i2", name: "old.txt", documentId: "d2", modifiedAt: "2026-01-01T10:00:00Z" }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("new.txt");

    expect(itemNameRows()).toEqual(["new.txt", "old.txt"]);

    await user.click(screen.getByRole("button", { name: "Sort by modified" }));

    expect(itemNameRows()).toEqual(["old.txt", "new.txt"]);
  });

  it("selects items from the grid view", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
    );

    const user = userEvent.setup();
    renderLibrary();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Grid view" }));
    await user.click(screen.getByRole("checkbox", { name: "Select contract.pdf" }));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("downloads a document", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/documents/d1/download`, () =>
        new HttpResponse("pdf-bytes", { headers: { "Content-Type": "application/pdf" } }),
      ),
    );

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:fake"),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Download contract.pdf" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("contract.pdf");
    expect(anchor.href).toBe("blob:fake");
  });

  it("deletes a document and reloads", async () => {
    mockNav();
    const items: unknown[] = [item()];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.delete(`${base}/documents/d1`, () => {
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Delete contract.pdf" }));

    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
    expect(mockedToast.success).toHaveBeenCalledWith("Item deleted");
  });

  it("deletes a folder and reports errors", async () => {
    mockNav();
    const items: unknown[] = [
      item({ kind: "folder", id: "i3", name: "Archived", documentId: null, folderId: "f3" }),
    ];
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json(items)),
      http.delete(`${base}/folders/f3`, () => {
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Delete Archived" }));

    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
  });

  it("reports a failed single delete", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.delete(`${base}/documents/d1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Delete contract.pdf" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete item"));
  });

  it("opens the document details sheet when a document row is clicked", async () => {
    mockNav();
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([item()])),
      http.get(`${base}/documents/d1`, () =>
        HttpResponse.json({
          id: "d1",
          libraryId: "l1",
          folderId: null,
          name: "contract.pdf",
          title: null,
          description: null,
          contentType: "application/pdf",
          sizeBytes: 2048,
          checkedOutBy: null,
          checkedOutAt: null,
          createdAt: "2026-03-01T10:00:00Z",
          modifiedAt: "2026-03-01T10:00:00Z",
          versionLabel: "1.0",
        }),
      ),
      http.get(`${base}/documents/d1/metadata`, () =>
        HttpResponse.json({ contentTypeId: null, contentTypeName: null, columns: [] }),
      ),
    );

    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "contract.pdf" }));

    expect(await screen.findByText("File type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByText("2.0 KB · v1.0 · application/pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByText("File type")).not.toBeInTheDocument());
    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  });

  it("opens library settings and saves the updated configuration", async () => {
    mockNav();
    server.use(
      http.put(`${base}/sites/s1/libraries/l1`, () => new HttpResponse(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Library settings" }));

    expect(await screen.findByText("Library settings")).toBeInTheDocument();
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Policies");

    await user.clear(nameInput);
    await user.type(nameInput, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Library settings saved"),
    );
    await waitFor(() =>
      expect(screen.queryByText("Library settings")).not.toBeInTheDocument(),
    );
  });

  it("reports an error when saving library settings fails", async () => {
    mockNav();
    server.use(
      http.put(`${base}/sites/s1/libraries/l1`, () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    renderLibrary();

    await user.click(await screen.findByRole("button", { name: "Library settings" }));
    await screen.findByText("Library settings");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to save library settings"),
    );
  });
});
