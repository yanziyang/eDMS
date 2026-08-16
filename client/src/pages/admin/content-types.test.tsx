import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminContentTypes } from "./content-types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function siteDto(overrides: Record<string, unknown> = {}) {
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

function libraryDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "l1",
    siteId: "s1",
    name: "Policies",
    description: null,
    enableVersioning: true,
    enableMinorVersions: false,
    requireCheckout: false,
    ...overrides,
  };
}

function columnDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "col1",
    name: "Vendor",
    dataType: "Text",
    isRequired: true,
    choiceOptions: null,
    defaultValue: null,
    ...overrides,
  };
}

function contentTypeDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "ct1",
    libraryId: null,
    name: "Invoice",
    description: null,
    columns: [] as unknown[],
    ...overrides,
  };
}

function mockNav(overrides: { types?: unknown[] } = {}) {
  server.use(
    http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
    http.get(`${base}/sites/s1/libraries`, () =>
      HttpResponse.json([libraryDto(), libraryDto({ id: "l2", name: "Finance" })]),
    ),
    http.get(`${base}/admin/content-types`, () => HttpResponse.json(overrides.types ?? [])),
  );
}

function renderContentTypes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminContentTypes />
      </QueryClientProvider>,
    ),
  };
}

async function pickLibraryScope(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Scope" }));
  await user.click(await screen.findByRole("option", { name: "Site One" }));
  await user.click(await screen.findByRole("combobox", { name: "Library" }));
  await user.click(await screen.findByRole("option", { name: "Policies" }));
}

describe("AdminContentTypes", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("lists org-wide content types by default without a libraryId filter", async () => {
    const urls: string[] = [];
    mockNav({
      types: [
        contentTypeDto({
          name: "Invoice",
          description: "Bills",
          columns: [columnDto()],
        }),
      ],
    });
    server.use(
      http.get(`${base}/admin/content-types`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([
          contentTypeDto({ name: "Invoice", description: "Bills", columns: [columnDto()] }),
        ]);
      }),
    );

    renderContentTypes();

    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    expect(screen.getByText("Bills")).toBeInTheDocument();
    expect(screen.getByText("Org-wide")).toBeInTheDocument();
    expect(screen.getByText("1 column")).toBeInTheDocument();
    expect(urls[0]).toBe(`${base}/admin/content-types`);
  });

  it("scopes the list by a picked library", async () => {
    const urls: string[] = [];
    mockNav({ types: [contentTypeDto({ libraryId: "l1", name: "Invoice" })] });
    server.use(
      http.get(`${base}/admin/content-types`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([contentTypeDto({ libraryId: "l1", name: "Invoice" })]);
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await pickLibraryScope(user);

    expect(await screen.findByText("Invoice")).toBeInTheDocument();
    expect(urls[0]).toBe(`${base}/admin/content-types`);
    expect(urls.some((url) => url.includes("libraryId=l1"))).toBe(true);
  });

  it("shows a hint until a library is picked, then the empty state", async () => {
    mockNav();

    const user = userEvent.setup();
    renderContentTypes();

    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(await screen.findByRole("option", { name: "Site One" }));

    expect(await screen.findByText("Pick a library to see its content types.")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Library" }));
    await user.click(await screen.findByRole("option", { name: "Policies" }));

    expect(await screen.findByText("No content types in this scope yet.")).toBeInTheDocument();
  });

  it("shows an error when content types fail to load", async () => {
    mockNav();
    server.use(
      http.get(`${base}/admin/content-types`, () => new HttpResponse(null, { status: 500 })),
    );

    renderContentTypes();

    expect(await screen.findByText("Failed to load content types.")).toBeInTheDocument();
  });

  it("creates a content type scoped to the current library", async () => {
    const types: unknown[] = [];
    const requests: Request[] = [];
    mockNav({ types });
    server.use(
      http.post(`${base}/admin/content-types`, async ({ request }) => {
        requests.push(request);
        types.push(contentTypeDto({ id: "ct2", name: "Contract", libraryId: "l1" }));
        return HttpResponse.json("ct2", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await pickLibraryScope(user);
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));
    await user.type(screen.getByLabelText("Name"), "Contract");
    await user.type(screen.getByLabelText("Description"), "Agreements");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Contract",
      description: "Agreements",
      libraryId: "l1",
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Content type created");
    expect(await screen.findByText("Contract")).toBeInTheDocument();
  });

  it("creates an org-wide content type with a null libraryId", async () => {
    const types: unknown[] = [];
    const requests: Request[] = [];
    mockNav({ types });
    server.use(
      http.post(`${base}/admin/content-types`, async ({ request }) => {
        requests.push(request);
        types.push(contentTypeDto({ id: "ct3", name: "Global" }));
        return HttpResponse.json("ct3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));

    await user.click(screen.getByRole("combobox", { name: "Library" }));
    expect(await screen.findByRole("option", { name: "Org-wide" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.type(screen.getByLabelText("Name"), "Global");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Global",
      description: null,
      libraryId: null,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Content type created");
  });

  it("edits a content type with prefilled values", async () => {
    const types: unknown[] = [contentTypeDto({ description: "Bills" })];
    const putRequests: Request[] = [];
    mockNav({ types });
    server.use(
      http.put(`${base}/admin/content-types/ct1`, async ({ request }) => {
        putRequests.push(request);
        types[0] = contentTypeDto({ name: "Invoice v2", description: "New" });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Edit Invoice" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Invoice");
    expect(screen.getByLabelText("Description")).toHaveValue("Bills");

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Invoice v2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(putRequests).toHaveLength(1));
    await expect(putRequests[0].json()).resolves.toEqual({
      name: "Invoice v2",
      description: "Bills",
      libraryId: null,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Content type updated");
    expect(await screen.findByText("Invoice v2")).toBeInTheDocument();
  });

  it("reports a failed content type creation", async () => {
    mockNav();
    server.use(
      http.post(`${base}/admin/content-types`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));
    await user.type(screen.getByLabelText("Name"), "Contract");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to create content type"),
    );
  });

  it("reports a failed content type update", async () => {
    mockNav({ types: [contentTypeDto()] });
    server.use(
      http.put(`${base}/admin/content-types/ct1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Edit Invoice" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to update content type"),
    );
  });

  it("does not submit an empty content type name", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.post(`${base}/admin/content-types`, () => {
        posts += 1;
        return HttpResponse.json("ct1", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));
    const createButton = await screen.findByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();
    fireEvent.click(createButton);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("cancels the create dialog without calling the API", async () => {
    mockNav();
    let posts = 0;
    server.use(
      http.post(`${base}/admin/content-types`, () => {
        posts += 1;
        return HttpResponse.json("ct1", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    await waitFor(() => expect(posts).toBe(0));
  });

  it("shows a pending state while creating a content type", async () => {
    mockNav();
    let resolveCreate!: (response: Response) => void;
    server.use(
      http.post(`${base}/admin/content-types`, () =>
        new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        }),
      ),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("No content types in this scope yet.");

    await user.click(screen.getByRole("button", { name: "New content type" }));
    await user.type(screen.getByLabelText("Name"), "Contract");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolveCreate(new HttpResponse("ct1", { status: 201 }));
  });

  it("deletes a content type after confirmation", async () => {
    const types: unknown[] = [contentTypeDto()];
    const deletes: string[] = [];
    mockNav({ types });
    server.use(
      http.delete(`${base}/admin/content-types/ct1`, ({ request }) => {
        deletes.push(request.url);
        types.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Delete Invoice" }));
    expect(screen.getByText('Delete "Invoice"?')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Content type deleted");
    expect(await screen.findByText("No content types in this scope yet.")).toBeInTheDocument();
  });

  it("cancels a content type delete without calling the API", async () => {
    mockNav({ types: [contentTypeDto()] });
    let deletes = 0;
    server.use(
      http.delete(`${base}/admin/content-types/ct1`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Delete Invoice" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText('Delete "Invoice"?')).not.toBeInTheDocument();
    await waitFor(() => expect(deletes).toBe(0));
  });

  it("reports a failed content type delete", async () => {
    mockNav({ types: [contentTypeDto()] });
    server.use(
      http.delete(`${base}/admin/content-types/ct1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Delete Invoice" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete content type"),
    );
  });

  it("lists columns and adds a Choice column with parsed options", async () => {
    const types: unknown[] = [contentTypeDto()];
    const requests: Request[] = [];
    mockNav({ types });
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, async ({ request }) => {
        requests.push(request);
        (types[0] as { columns: unknown[] }).columns.push(
          columnDto({
            id: "col2",
            name: "Vendor",
            dataType: "Choice",
            isRequired: true,
            choiceOptions: '["Acme","Globex"]',
            defaultValue: "Acme",
          }),
        );
        return HttpResponse.json("col2", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    expect(
      await screen.findByText("No columns yet. Add one to capture custom metadata."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByLabelText("Name"), "Vendor");
    await user.click(screen.getByRole("combobox", { name: "Data type" }));
    await user.click(await screen.findByRole("option", { name: "Choice" }));
    expect(await screen.findByLabelText("Choice options")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Choice options"), {
      target: { value: '["Acme","Globex"]' },
    });
    await user.click(screen.getByRole("checkbox", { name: "Required" }));
    await user.type(screen.getByLabelText("Default value"), "Acme");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Vendor",
      dataType: "Choice",
      isRequired: true,
      choiceOptions: '["Acme","Globex"]',
      defaultValue: "Acme",
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Column added");
    expect(await screen.findByText('["Acme","Globex"]')).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("rejects invalid choice options without submitting", async () => {
    mockNav({ types: [contentTypeDto()] });
    let posts = 0;
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, () => {
        posts += 1;
        return HttpResponse.json("col2", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    await screen.findByText("No columns yet. Add one to capture custom metadata.");
    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByLabelText("Name"), "Vendor");
    await user.click(screen.getByRole("combobox", { name: "Data type" }));
    await user.click(await screen.findByRole("option", { name: "Choice" }));
    await user.type(screen.getByLabelText("Choice options"), "Acme, Globex");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith(
        "Choice options must be a JSON array of strings",
      ),
    );
    expect(posts).toBe(0);
  });

  it("adds a non-choice column without choice options", async () => {
    const types: unknown[] = [contentTypeDto()];
    const requests: Request[] = [];
    mockNav({ types });
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, async ({ request }) => {
        requests.push(request);
        (types[0] as { columns: unknown[] }).columns.push(columnDto({ id: "col3" }));
        return HttpResponse.json("col3", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    await screen.findByText("No columns yet. Add one to capture custom metadata.");
    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByLabelText("Name"), "Amount");
    await user.click(screen.getByRole("combobox", { name: "Data type" }));
    await user.click(await screen.findByRole("option", { name: "Number" }));
    expect(screen.queryByLabelText("Choice options")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Default value"), "0");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      name: "Amount",
      dataType: "Number",
      isRequired: false,
      choiceOptions: null,
      defaultValue: "0",
    });
  });

  it("edits a column with prefilled values", async () => {
    const types: unknown[] = [contentTypeDto({ columns: [columnDto()] })];
    const putRequests: Request[] = [];
    mockNav({ types });
    server.use(
      http.put(`${base}/admin/columns/col1`, async ({ request }) => {
        putRequests.push(request);
        (types[0] as { columns: unknown[] }).columns[0] = columnDto({ name: "Supplier" });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));

    expect(await screen.findByText("Vendor")).toBeInTheDocument();
    expect(screen.getByText("Text")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Vendor" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Vendor");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Supplier");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(putRequests).toHaveLength(1));
    await expect(putRequests[0].json()).resolves.toEqual({
      name: "Supplier",
      dataType: "Text",
      isRequired: true,
      choiceOptions: null,
      defaultValue: null,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Column updated");
    expect(await screen.findByText("Supplier")).toBeInTheDocument();
  });

  it("deletes a column", async () => {
    const types: unknown[] = [contentTypeDto({ columns: [columnDto()] })];
    const deletes: string[] = [];
    mockNav({ types });
    server.use(
      http.delete(`${base}/admin/columns/col1`, ({ request }) => {
        deletes.push(request.url);
        (types[0] as { columns: unknown[] }).columns.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    await screen.findByText("Vendor");

    await user.click(screen.getByRole("button", { name: "Delete Vendor" }));

    await waitFor(() => expect(deletes).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Column deleted");
    expect(
      await screen.findByText("No columns yet. Add one to capture custom metadata."),
    ).toBeInTheDocument();
  });

  it("reports failed column add and delete", async () => {
    mockNav({ types: [contentTypeDto({ columns: [columnDto()] })] });
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, () =>
        new HttpResponse(null, { status: 500 }),
      ),
      http.delete(`${base}/admin/columns/col1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    await screen.findByText("Vendor");

    await user.click(screen.getByRole("button", { name: "Delete Vendor" }));
    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to delete column"));

    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.type(screen.getByLabelText("Name"), "Nope");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to add column"));
  });

  it("cancels the add column dialog without calling the API", async () => {
    mockNav({ types: [contentTypeDto()] });
    let posts = 0;
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, () => {
        posts += 1;
        return HttpResponse.json("col2", { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderContentTypes();
    await screen.findByText("Invoice");

    await user.click(screen.getByRole("button", { name: "Columns Invoice" }));
    await screen.findByText("No columns yet. Add one to capture custom metadata.");
    await user.click(screen.getByRole("button", { name: "Add column" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Add" })).not.toBeInTheDocument();
    await waitFor(() => expect(posts).toBe(0));
  });
});
