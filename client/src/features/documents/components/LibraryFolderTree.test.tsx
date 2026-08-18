import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import { LibraryFolderTree } from "./LibraryFolderTree";

const base = "http://localhost:5080/api/v1";

function folder(id: string, name: string) {
  return {
    kind: "folder",
    id,
    name,
    sizeBytes: 0,
    modifiedAt: "2026-08-18T00:00:00Z",
    folderId: id,
    documentId: null,
    checkedOutBy: null,
  };
}

function renderTree(onSelectFolder = vi.fn(), selectedFolderId: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return {
    onSelectFolder,
    ...render(
      <QueryClientProvider client={queryClient}>
        <LibraryFolderTree
          libraryId="l1"
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("LibraryFolderTree", () => {
  afterEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
  });

  it("selects a root folder and lazily loads nested folders", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([folder("f1", "Contracts")]),
      ),
      http.get(`${base}/folders/f1/items`, () =>
        HttpResponse.json([folder("f2", "Archive")]),
      ),
    );

    const user = userEvent.setup();
    const { onSelectFolder } = renderTree();

    await user.click(await screen.findByRole("button", { name: "Open folder Contracts" }));
    expect(onSelectFolder).toHaveBeenCalledWith("f1", "Contracts");

    await user.click(screen.getByRole("button", { name: "Expand Contracts" }));
    expect(await screen.findByRole("button", { name: "Open folder Archive" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open folder Archive" }));
    expect(onSelectFolder).toHaveBeenCalledWith("f2", "Archive");
  });

  it("shows root and nested empty states", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => HttpResponse.json([])),
    );

    renderTree();

    expect(await screen.findByText("No folders yet.")).toBeInTheDocument();
  });

  it("shows a nested loading error", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([folder("f1", "Contracts")]),
      ),
      http.get(`${base}/folders/f1/items`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(await screen.findByRole("button", { name: "Expand Contracts" }));
    await waitFor(() => expect(screen.getByText("Failed to load subfolders.")).toBeInTheDocument());
  });

  it("resets to the library root from the All documents button", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([folder("f1", "Contracts")]),
      ),
    );

    const user = userEvent.setup();
    const { onSelectFolder } = renderTree(vi.fn(), "f1");

    await user.click(screen.getByRole("button", { name: "All documents" }));

    expect(onSelectFolder).toHaveBeenCalledWith(null, "All documents");
  });

  it("collapses an expanded folder with ArrowLeft", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([folder("f1", "Contracts")]),
      ),
      http.get(`${base}/folders/f1/items`, () =>
        HttpResponse.json([folder("f2", "Archive")]),
      ),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(await screen.findByRole("button", { name: "Expand Contracts" }));
    await screen.findByRole("button", { name: "Open folder Archive" });
    const openButton = screen.getByRole("button", { name: "Open folder Contracts" });
    openButton.focus();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("button", { name: "Expand Contracts" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open folder Archive" })).not.toBeInTheDocument();
  });

  it("shows the nested empty state", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        HttpResponse.json([folder("f1", "Contracts")]),
      ),
      http.get(`${base}/folders/f1/items`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderTree();

    await user.click(await screen.findByRole("button", { name: "Expand Contracts" }));
    expect(await screen.findByText("No subfolders.")).toBeInTheDocument();
  });

  it("shows the root loading state while folders are pending", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(HttpResponse.json([folder("f1", "Contracts")])), 100)),
      ),
    );

    renderTree();

    expect(screen.getByRole("status")).toHaveTextContent("Loading folders…");
    expect(await screen.findByRole("button", { name: "Open folder Contracts" })).toBeInTheDocument();
  });

  it("shows a root error state", async () => {
    server.use(
      http.get(`${base}/libraries/l1/items`, () => new HttpResponse(null, { status: 500 })),
    );

    renderTree();

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load folders.");
  });
});
