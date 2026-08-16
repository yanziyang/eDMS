import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { requestBlob } from "@/lib/api-client";
import { queryKeys } from "@/lib/queryKeys";
import { DocumentDetailsSheet } from "./DocumentDetailsSheet";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    status: "authenticated",
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, requestBlob: vi.fn() };
});

const mockedToast = vi.mocked(toast);
const requestBlobMock = vi.mocked(requestBlob);
const base = "http://localhost:5080/api/v1";
const permissionsUrl = `${base}/Document/objects/d1/permissions`;
const metadataUrl = `${base}/documents/d1/metadata`;

function documentDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    libraryId: "l1",
    folderId: null,
    name: "contract.pdf",
    title: "Contract",
    description: "Main contract",
    contentType: "application/pdf",
    sizeBytes: 2048,
    checkedOutBy: null,
    checkedOutAt: null,
    createdAt: "2026-03-01T10:00:00Z",
    modifiedAt: "2026-03-02T10:00:00Z",
    versionLabel: "2.0",
    ...overrides,
  };
}

function versionDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "v2",
    versionMajor: 2,
    versionMinor: 0,
    sizeBytes: 2048,
    comment: "Final",
    isMajor: true,
    createdBy: "u1",
    createdAt: "2026-03-02T10:00:00Z",
    ...overrides,
  };
}

function permissionsState(overrides: Record<string, unknown> = {}) {
  return {
    hasUniqueAcl: false,
    entries: [],
    ...overrides,
  };
}

function renderSheet(documentId = "d1") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <DocumentDetailsSheet documentId={documentId} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { ...utils, queryClient, onOpenChange };
}

async function openTab(name: "Versions" | "Permissions") {
  renderSheet();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("tab", { name }));
  return user;
}

function mockObjectURLs() {
  const createObjectURL = vi.fn(() => "blob:preview-url");
  const revokeObjectURL = vi.fn(() => {});
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
  return { createObjectURL, revokeObjectURL };
}

describe("DocumentDetailsSheet", () => {
  beforeEach(() => {
    server.use(
      http.get(metadataUrl, () =>
        HttpResponse.json({ contentTypeId: null, contentTypeName: null, columns: [] }),
      ),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading state, then the properties tab", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
    );

    renderSheet();

    expect(screen.getByText("Loading…")).toBeInTheDocument();

    expect(await screen.findByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB · v2.0 · application/pdf")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("contract.pdf");
    expect(screen.getByLabelText("Title")).toHaveValue("Contract");
    expect(screen.getByLabelText("Description")).toHaveValue("Main contract");
    expect(screen.getByText("File size")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("File type")).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
    expect(screen.getByText("Current version")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Modified")).toBeInTheDocument();
    expect(screen.getByText("Checked in")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Properties" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Versions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Permissions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("shows an error state when the document fails to load", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => new HttpResponse(null, { status: 500 })),
    );

    renderSheet();

    expect(await screen.findByText("Failed to load document.")).toBeInTheDocument();
  });

  it("renames the document and invalidates library items", async () => {
    let name = "contract.pdf";
    const bodies: unknown[] = [];
    let resolvePut!: (response: Response) => void;
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ name }))),
      http.put(`${base}/documents/d1`, async ({ request }) => {
        const body = await request.json();
        bodies.push(body);
        if (typeof body === "object" && body !== null && "name" in body && typeof body.name === "string") {
          name = body.name;
        }
        return new Promise<Response>((resolve) => {
          resolvePut = resolve;
        });
      }),
    );

    const { queryClient } = renderSheet();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    await screen.findByText("contract.pdf");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "renamed.pdf");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolvePut(new HttpResponse(null, { status: 204 }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Document updated"),
    );
    expect(bodies).toEqual([
      { name: "renamed.pdf", title: "Contract", description: "Main contract" },
    ]);
    expect(await screen.findByText("renamed.pdf")).toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.documents.libraryItems("l1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.documents.detail("d1"),
    });
  });

  it("updates metadata without renaming", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () =>
        HttpResponse.json(documentDto({ title: null, description: null })),
      ),
      http.put(`${base}/documents/d1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("contract.pdf");

    await user.type(screen.getByLabelText("Title"), "Updated");
    await user.type(screen.getByLabelText("Description"), "Changed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      title: "Updated",
      description: "Changed",
    });
  });

  it("invalidates folder items when renaming a document inside a folder", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () =>
        HttpResponse.json(documentDto({ folderId: "f1", name: "a.txt", title: "T", description: "D" })),
      ),
      http.put(`${base}/documents/d1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { queryClient } = renderSheet();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();
    await screen.findByText("a.txt");

    await user.clear(screen.getByLabelText("Title"));
    await user.clear(screen.getByLabelText("Description"));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "b.txt");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "b.txt",
      title: null,
      description: null,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.folders.items("f1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.documents.libraryItems("l1"),
    });
  });

  it("shows an error toast when saving fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.put(`${base}/documents/d1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to update document"),
    );
  });

  it("shows the checked out badge, a gigabyte size and a missing modified date", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () =>
        HttpResponse.json(
          documentDto({
            checkedOutBy: "u1",
            modifiedAt: null,
            sizeBytes: 2 * 1024 * 1024 * 1024,
            versionLabel: "1.0",
          }),
        ),
      ),
    );

    renderSheet();

    expect(await screen.findByText("Checked out")).toBeInTheDocument();
    expect(screen.getByText("2.0 GB · v1.0 · application/pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 GB")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("lists versions and restores an older one", async () => {
    let versionCalls = 0;
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(`${base}/documents/d1/versions`, () => {
        versionCalls += 1;
        return HttpResponse.json([
          versionDto({ id: "v2", versionMajor: 2, versionMinor: 0, sizeBytes: 2048, comment: "Final" }),
          versionDto({ id: "v1", versionMajor: 1, versionMinor: 0, sizeBytes: 500, comment: null }),
          versionDto({ id: "v0", versionMajor: 0, versionMinor: 5, sizeBytes: 5 * 1024 * 1024, comment: "Draft" }),
          versionDto({ id: "v00", versionMajor: 0, versionMinor: 1, sizeBytes: 2 * 1024 * 1024 * 1024, comment: "Init" }),
        ]);
      }),
      http.post(`${base}/documents/d1/versions/v1/restore`, () => new HttpResponse(null, { status: 204 })),
    );

    const user = await openTab("Versions");

    expect(await screen.findByText("Current")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("0.5")).toBeInTheDocument();
    expect(screen.getByText("0.1")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    expect(screen.getByText("500 B")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    expect(screen.getByText("2.0 GB")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Init")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Restore" })).toHaveLength(3);

    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]);

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Version restored"),
    );
    await waitFor(() => expect(versionCalls).toBe(2));
  });

  it("shows an error toast when restoring a version fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(`${base}/documents/d1/versions`, () =>
        HttpResponse.json([
          versionDto({ id: "v2" }),
          versionDto({ id: "v1", versionMajor: 1 }),
        ]),
      ),
      http.post(`${base}/documents/d1/versions/v1/restore`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Versions");
    await screen.findByText("Current");

    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]);

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to restore version"),
    );
  });

  it("checks out a document and shows the check-in controls afterwards", async () => {
    let checkedOutBy: string | null = null;
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/checkout`, () => {
        checkedOutBy = "u1";
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Versions");
    expect(await screen.findByText("No versions found.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check out" }));

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Checked out"));
    expect(await screen.findByRole("button", { name: "Check in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard check out" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check out" })).not.toBeInTheDocument();
  });

  it("checks in a document with a comment", async () => {
    let checkedOutBy: string | null = "u1";
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/checkin`, async ({ request }) => {
        requests.push(request);
        checkedOutBy = null;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Versions");
    await screen.findByRole("button", { name: "Check in" });

    await user.type(screen.getByLabelText("Check-in comment"), "Fixed typo");
    await user.click(screen.getByRole("button", { name: "Check in" }));

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Checked in"));
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({ comment: "Fixed typo" });
    expect(await screen.findByRole("button", { name: "Check out" })).toBeInTheDocument();
  });

  it("checks in without a comment", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy: "u1" }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/checkin`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Versions");
    await user.click(await screen.findByRole("button", { name: "Check in" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({ comment: null });
  });

  it("discards a check out", async () => {
    let checkedOutBy: string | null = "u1";
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/discard-checkout`, () => {
        checkedOutBy = null;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Versions");
    await user.click(await screen.findByRole("button", { name: "Discard check out" }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Check-out discarded"),
    );
    expect(await screen.findByRole("button", { name: "Check out" })).toBeInTheDocument();
  });

  it("shows a disabled state when checked out by someone else", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy: "u2" }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
    );

    await openTab("Versions");

    const button = await screen.findByRole("button", { name: "Checked out by someone else" });
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check out" })).not.toBeInTheDocument();
  });

  it("shows an error toast when check out fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/checkout`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Versions");
    await user.click(await screen.findByRole("button", { name: "Check out" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to check out"));
  });

  it("shows an error toast when check in fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy: "u1" }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/checkin`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Versions");
    await user.click(await screen.findByRole("button", { name: "Check in" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to check in"));
  });

  it("shows an error toast when discarding a check out fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ checkedOutBy: "u1" }))),
      http.get(`${base}/documents/d1/versions`, () => HttpResponse.json([])),
      http.post(`${base}/documents/d1/discard-checkout`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Versions");
    await user.click(await screen.findByRole("button", { name: "Discard check out" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to discard check-out"),
    );
  });

  it("shows an error state when versions fail to load", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(`${base}/documents/d1/versions`, () => new HttpResponse(null, { status: 500 })),
    );

    await openTab("Versions");

    expect(await screen.findByText("Failed to load versions.")).toBeInTheDocument();
  });

  it("shows inherited permissions", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () =>
        HttpResponse.json(
          permissionsState({
            entries: [
              { principalType: "Group", principalId: "g1", principalName: "Site Owners", level: "FullControl", source: "Inherited" },
              { principalType: "User", principalId: "u2", principalName: "Bob", level: "Read", source: "Inherited" },
              { principalType: "Group", principalId: "g2", principalName: "Blocked", level: "NoAccess", source: "Inherited" },
            ],
          }),
        ),
      ),
    );

    await openTab("Permissions");

    expect(await screen.findByText("Inherited permissions")).toBeInTheDocument();
    expect(screen.getByText("Site Owners")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Full Control")).toBeInTheDocument();
    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("No Access")).toBeInTheDocument();
    expect(screen.getAllByText("Inherited")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop inheriting permissions" })).toBeInTheDocument();
  });

  it("stops inheriting and grants a permission", async () => {
    let state = permissionsState({
      entries: [
        { principalType: "Group", principalId: "g1", principalName: "Site Owners", level: "FullControl", source: "Inherited" },
      ],
    });
    const requests: Request[] = [];
    let resolveGrant!: (response: Response) => void;
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(state)),
      http.post(permissionsUrl, async ({ request }) => {
        requests.push(request);
        return new Promise<Response>((resolve) => {
          resolveGrant = resolve;
        });
      }),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Stop inheriting permissions" }));

    fireEvent.click(screen.getByRole("combobox", { name: "Principal type" }));
    fireEvent.click(await screen.findByRole("option", { name: "Group" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Group" })).not.toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText("Principal ID"), "g1");
    fireEvent.click(screen.getByRole("combobox", { name: "Permission level" }));
    fireEvent.click(await screen.findByRole("option", { name: "Contribute" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Contribute" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Grant" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    state = permissionsState({
      hasUniqueAcl: true,
      entries: [
        { principalType: "Group", principalId: "g1", principalName: "Legal Team", level: "Contribute", source: "Direct" },
      ],
    });
    resolveGrant(new HttpResponse(null, { status: 204 }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Permission granted"),
    );
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      principalType: "Group",
      principalId: "g1",
      level: "Contribute",
    });
    expect(await screen.findByText("Unique permissions")).toBeInTheDocument();
    expect(screen.getByText("Legal Team")).toBeInTheDocument();
    expect(screen.getByText("Contribute")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke Legal Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant access" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to inherited" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Grant" })).not.toBeInTheDocument();
  });

  it("shows an error toast when granting fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(permissionsState())),
      http.post(permissionsUrl, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Stop inheriting permissions" }));
    await user.type(screen.getByLabelText("Principal ID"), "g1");
    await user.click(screen.getByRole("button", { name: "Grant" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to grant permission"),
    );
  });

  it("cancels the grant form", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(permissionsState())),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Stop inheriting permissions" }));
    expect(screen.getByLabelText("Principal ID")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Principal ID")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop inheriting permissions" })).toBeInTheDocument();
  });

  it("does not submit the grant form with an empty principal id", async () => {
    let posts = 0;
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(permissionsState())),
      http.post(permissionsUrl, () => {
        posts += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await openTab("Permissions");
    await screen.findByRole("button", { name: "Stop inheriting permissions" });
    await fireEvent.click(screen.getByRole("button", { name: "Stop inheriting permissions" }));

    expect(screen.getByRole("button", { name: "Grant" })).toBeDisabled();
    const form = screen.getByLabelText("Principal ID").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("revokes a permission", async () => {
    let state = permissionsState({
      hasUniqueAcl: true,
      entries: [
        { principalType: "User", principalId: "u2", principalName: "Bob", level: "Read", source: "Direct" },
      ],
    });
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(state)),
      http.delete(`${base}/Document/objects/d1/permissions/User/u2`, () => {
        state = permissionsState({ hasUniqueAcl: true });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Revoke Bob" }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Permission revoked"),
    );
    expect(await screen.findByText("No permissions granted.")).toBeInTheDocument();
  });

  it("shows an error toast when revoking fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () =>
        HttpResponse.json(
          permissionsState({
            hasUniqueAcl: true,
            entries: [
              { principalType: "User", principalId: "u2", principalName: "Bob", level: "Read", source: "Direct" },
            ],
          }),
        ),
      ),
      http.delete(`${base}/Document/objects/d1/permissions/User/u2`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Revoke Bob" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to revoke permission"),
    );
  });

  it("resets to inherited permissions", async () => {
    let state = permissionsState({
      hasUniqueAcl: true,
      entries: [
        { principalType: "User", principalId: "u2", principalName: "Bob", level: "Read", source: "Direct" },
      ],
    });
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(state)),
      http.post(`${base}/Document/objects/d1/permissions/reset`, () => {
        state = permissionsState();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Reset to inherited" }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Reset to inherited permissions"),
    );
    expect(await screen.findByText("Inherited permissions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("shows an error toast when resetting fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () =>
        HttpResponse.json(
          permissionsState({
            hasUniqueAcl: true,
            entries: [
              { principalType: "User", principalId: "u2", principalName: "Bob", level: "Read", source: "Direct" },
            ],
          }),
        ),
      ),
      http.post(`${base}/Document/objects/d1/permissions/reset`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = await openTab("Permissions");
    await user.click(await screen.findByRole("button", { name: "Reset to inherited" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to reset permissions"),
    );
  });

  it("shows an empty state for a unique acl without entries", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => HttpResponse.json(permissionsState({ hasUniqueAcl: true }))),
    );

    const user = await openTab("Permissions");

    expect(await screen.findByText("No permissions granted.")).toBeInTheDocument();
    expect(screen.getByText("Unique permissions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to inherited" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Grant access" }));

    expect(screen.getByLabelText("Principal ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Grant" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reset to inherited" })).not.toBeInTheDocument();
  });

  it("shows an error state when permissions fail to load", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(permissionsUrl, () => new HttpResponse(null, { status: 500 })),
    );

    await openTab("Permissions");

    expect(await screen.findByText("Failed to load permissions.")).toBeInTheDocument();
  });

  it("opens the share dialog from the header and cancels it", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(`${base}/users`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByText('Share "contract.pdf"')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText('Share "contract.pdf"')).not.toBeInTheDocument(),
    );
  });

  it("closes the sheet through the close button", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
    );

    const { onOpenChange } = renderSheet();
    await screen.findByText("contract.pdf");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders metadata values from the metadata endpoint", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () =>
        HttpResponse.json({
          contentTypeId: "ct1",
          contentTypeName: "Invoice",
          columns: [
            {
              columnDefinitionId: "col1",
              name: "Vendor",
              dataType: "Choice",
              isRequired: true,
              choiceOptions: '["Acme","Globex"]',
              defaultValue: null,
              value: "Acme",
            },
            {
              columnDefinitionId: "col2",
              name: "Amount",
              dataType: "Number",
              isRequired: false,
              choiceOptions: null,
              defaultValue: null,
              value: "42",
            },
            {
              columnDefinitionId: "col3",
              name: "Approved",
              dataType: "Boolean",
              isRequired: false,
              choiceOptions: null,
              defaultValue: null,
              value: "true",
            },
            {
              columnDefinitionId: "col4",
              name: "Due date",
              dataType: "Date",
              isRequired: true,
              choiceOptions: null,
              defaultValue: null,
              value: null,
            },
          ],
        }),
      ),
    );

    renderSheet();

    expect(await screen.findByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Invoice")).toBeInTheDocument();
    expect(screen.getByText("Vendor *")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("Due date *")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the no-metadata state when the document has no content type", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
    );

    renderSheet();

    expect(await screen.findByText("No custom metadata fields.")).toBeInTheDocument();
  });

  it("renders nothing when metadata fails to load", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () => new HttpResponse(null, { status: 500 })),
    );

    renderSheet();
    await screen.findByText("contract.pdf");

    expect(screen.queryByText("Metadata")).not.toBeInTheDocument();
  });

  it("edits and saves metadata values", async () => {
    const columns: Array<Record<string, unknown>> = [
      {
        columnDefinitionId: "col1",
        name: "Vendor",
        dataType: "Choice",
        isRequired: true,
        choiceOptions: '["Acme","Globex"]',
        defaultValue: null,
        value: "Acme",
      },
      {
        columnDefinitionId: "col2",
        name: "Amount",
        dataType: "Number",
        isRequired: false,
        choiceOptions: null,
        defaultValue: null,
        value: "42",
      },
      {
        columnDefinitionId: "col3",
        name: "Approved",
        dataType: "Boolean",
        isRequired: false,
        choiceOptions: null,
        defaultValue: null,
        value: "true",
      },
      {
        columnDefinitionId: "col4",
        name: "Due date",
        dataType: "Date",
        isRequired: false,
        choiceOptions: null,
        defaultValue: null,
        value: null,
      },
    ];
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () => HttpResponse.json({ contentTypeId: "ct1", contentTypeName: "Invoice", columns })),
      http.put(`${base}/documents/d1/metadata-values`, async ({ request }) => {
        requests.push(request);
        (columns[0] as Record<string, unknown>).value = "Globex";
        (columns[1] as Record<string, unknown>).value = "100";
        (columns[2] as Record<string, unknown>).value = "false";
        (columns[3] as Record<string, unknown>).value = "2026-06-01";
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { queryClient } = renderSheet();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await screen.findByText("Metadata");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit" }));

    await user.click(screen.getByRole("combobox", { name: "Vendor *" }));
    await user.click(await screen.findByRole("option", { name: "Globex" }));

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "100");

    await user.click(screen.getByRole("checkbox", { name: "Approved" }));

    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-06-01" },
    });

    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      values: [
        { columnDefinitionId: "col1", value: "Globex" },
        { columnDefinitionId: "col2", value: "100" },
        { columnDefinitionId: "col4", value: "2026-06-01" },
      ],
    });
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Metadata updated"));
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.documents.metadata("d1"),
    });
    expect(await screen.findByText("Globex")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save metadata" })).not.toBeInTheDocument();
  });

  it("blocks saving when a required field is empty", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () =>
        HttpResponse.json({
          contentTypeId: "ct1",
          contentTypeName: "Invoice",
          columns: [
            {
              columnDefinitionId: "col1",
              name: "Vendor",
              dataType: "Text",
              isRequired: true,
              choiceOptions: null,
              defaultValue: null,
              value: null,
            },
          ],
        }),
      ),
      http.put(`${base}/documents/d1/metadata-values`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Metadata");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Missing required metadata: Vendor"),
    );
    expect(requests).toHaveLength(0);
  });

  it("cancels the metadata edit form", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () =>
        HttpResponse.json({
          contentTypeId: "ct1",
          contentTypeName: "Invoice",
          columns: [
            {
              columnDefinitionId: "col1",
              name: "Vendor",
              dataType: "Text",
              isRequired: true,
              choiceOptions: null,
              defaultValue: null,
              value: "Acme",
            },
          ],
        }),
      ),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Metadata");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Vendor *")).toHaveValue("Acme");
    await user.clear(screen.getByLabelText("Vendor *"));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save metadata" })).not.toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
  });

  it("shows an error toast when saving metadata fails", async () => {
    server.use(
      http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      http.get(metadataUrl, () =>
        HttpResponse.json({
          contentTypeId: "ct1",
          contentTypeName: "Invoice",
          columns: [
            {
              columnDefinitionId: "col1",
              name: "Vendor",
              dataType: "Text",
              isRequired: false,
              choiceOptions: null,
              defaultValue: null,
              value: "Acme",
            },
          ],
        }),
      ),
      http.put(`${base}/documents/d1/metadata-values`, () =>
        new HttpResponse(null, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("Metadata");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save metadata" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to update metadata"),
    );
  });

  describe("Preview tab", () => {
    const officeContentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    it("shows a loading state while the preview is fetched", async () => {
      requestBlobMock.mockReturnValueOnce(new Promise<Blob>(() => {}));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      expect(screen.getByText("Loading preview…")).toBeInTheDocument();
      expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
      expect(requestBlobMock).toHaveBeenCalledWith("/documents/d1/preview");
    });

    it("renders the preview iframe with a blob url", async () => {
      mockObjectURLs();
      requestBlobMock.mockResolvedValueOnce(new Blob(["%PDF"], { type: "application/pdf" }));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      const iframe = await screen.findByTitle("Preview");
      expect(iframe).toHaveAttribute("src", "blob:preview-url");
      expect(requestBlobMock).toHaveBeenCalledWith("/documents/d1/preview");
    });

    it("shows an error state and retries the fetch", async () => {
      mockObjectURLs();
      requestBlobMock
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(new Blob(["%PDF"], { type: "application/pdf" }));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      expect(await screen.findByText("Failed to load preview.")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByTitle("Preview")).toBeInTheDocument();
      expect(requestBlobMock).toHaveBeenCalledTimes(2);
    });

    it("revokes the object url when the preview tab is closed", async () => {
      const { revokeObjectURL } = mockObjectURLs();
      requestBlobMock.mockResolvedValueOnce(new Blob(["%PDF"], { type: "application/pdf" }));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));
      await screen.findByTitle("Preview");

      await user.click(screen.getByRole("tab", { name: "Properties" }));

      await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-url"));
    });

    it("renders the converted pdf for an office document", async () => {
      mockObjectURLs();
      requestBlobMock.mockResolvedValueOnce(new Blob(["%PDF"], { type: "application/pdf" }));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ contentType: officeContentType }))),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      expect(await screen.findByTitle("Preview")).toHaveAttribute("src", "blob:preview-url");
    });

    it("shows the office fallback note when preview conversion is unavailable", async () => {
      requestBlobMock.mockResolvedValueOnce(new Blob(["PK"], { type: officeContentType }));
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ contentType: officeContentType }))),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      expect(await screen.findByText("Preview not available for this file type")).toBeInTheDocument();
      expect(
        screen.getByText("Office preview conversion is unavailable right now. Download the file to view it."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
      expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
    });

    it("shows the non-renderable note for other file types without fetching", async () => {
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ contentType: "application/zip" }))),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));

      expect(await screen.findByText("Preview not available for this file type")).toBeInTheDocument();
      expect(screen.queryByText(/Office preview conversion/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
      expect(requestBlobMock).not.toHaveBeenCalled();
    });

    it("ignores a stale preview result after the tab is closed", async () => {
      const { createObjectURL } = mockObjectURLs();
      let resolvePreview!: (blob: Blob) => void;
      requestBlobMock.mockReturnValueOnce(
        new Promise<Blob>((resolve) => {
          resolvePreview = resolve;
        }),
      );
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto())),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));
      expect(screen.getByText("Loading preview…")).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Properties" }));
      await act(async () => {
        resolvePreview(new Blob(["%PDF"], { type: "application/pdf" }));
      });

      expect(createObjectURL).not.toHaveBeenCalled();
      expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
    });

    it("downloads the file from the unavailable note", async () => {
      mockObjectURLs();
      requestBlobMock.mockResolvedValueOnce(new Blob(["data"], { type: "application/zip" }));
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      server.use(
        http.get(`${base}/documents/d1`, () => HttpResponse.json(documentDto({ contentType: "application/zip" }))),
      );

      const user = userEvent.setup();
      renderSheet();
      await screen.findByText("contract.pdf");
      await user.click(screen.getByRole("tab", { name: "Preview" }));
      await user.click(await screen.findByRole("button", { name: "Download" }));

      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    });
  });
});
