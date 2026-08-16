import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminAuditLog } from "./audit-log";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function siteDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    name: "Finance",
    description: null,
    urlSlug: "finance",
    storageQuotaBytes: null,
    storageUsedBytes: 0,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function auditEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    timestamp: "2026-03-01T10:00:00Z",
    userId: "u42",
    action: "document.uploaded",
    objectType: "Document",
    objectId: "d1",
    objectName: "contract.pdf",
    siteId: "s1",
    ipAddress: "10.0.0.1",
    ...overrides,
  };
}

function renderAuditLog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminAuditLog />
      </QueryClientProvider>,
    ),
  };
}

describe("AdminAuditLog", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("lets the admin pick a site and shows its audit events", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () =>
        HttpResponse.json([
          auditEntry(),
          auditEntry({
            id: "a2",
            timestamp: "2026-03-02T09:30:00Z",
            userId: "u7",
            action: "document.downloaded",
            objectType: "Document",
            objectId: "d2",
            objectName: "policy.docx",
            ipAddress: "10.0.0.2",
          }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderAuditLog();

    expect(await screen.findByText("Select a site to view its audit log.")).toBeInTheDocument();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));

    expect(await screen.findByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText(new Date("2026-03-01T10:00:00Z").toLocaleString())).toBeInTheDocument();
    expect(screen.getByText("u42")).toBeInTheDocument();
    expect(screen.getByText("document.uploaded")).toBeInTheDocument();
    expect(screen.getAllByText("Document").length).toBeGreaterThan(0);
    expect(screen.getByText("10.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("policy.docx")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 events")).toBeInTheDocument();
  });

  it("filters events by action and updates the count", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () =>
        HttpResponse.json([
          auditEntry(),
          auditEntry({ id: "a2", action: "document.deleted", objectName: "policy.docx" }),
          auditEntry({ id: "a3", action: "document.downloaded", objectName: "notes.txt" }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderAuditLog();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await screen.findByText("contract.pdf");

    expect(screen.getByText("3 of 3 events")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Filter by action…"), "uploaded");

    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
    expect(screen.queryByText("policy.docx")).not.toBeInTheDocument();
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3 events")).toBeInTheDocument();
  });

  it("exports the filtered rows as a CSV download", async () => {
    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:audit";
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: revokeObjectURL,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () =>
        HttpResponse.json([
          auditEntry(),
          auditEntry({
            id: "a2",
            action: "document.downloaded",
            objectName: "report, final.pdf",
          }),
        ]),
      ),
    );

    const user = userEvent.setup();
    renderAuditLog();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await screen.findByText("contract.pdf");

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:audit");
    expect(mockedToast.success).toHaveBeenCalledWith("Audit log exported");

    const text = await capturedBlob!.text();
    expect(text).toContain("Time,User ID,Action,Object type,Object name,IP address");
    expect(text).toContain("document.uploaded");
    expect(text).toContain('"report, final.pdf"');
  });

  it("disables export when no rows match the filter", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () => HttpResponse.json([auditEntry()])),
    );

    const user = userEvent.setup();
    renderAuditLog();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));
    await screen.findByText("contract.pdf");

    await user.type(screen.getByPlaceholderText("Filter by action…"), "nothing-matches");

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("shows the empty state when the site has no events", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderAuditLog();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));

    expect(await screen.findByText("No audit events found.")).toBeInTheDocument();
  });

  it("shows an error when the audit log fails to load", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([siteDto()])),
      http.get(`${base}/sites/s1/audit-log`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderAuditLog();

    await user.click(await screen.findByRole("combobox", { name: "Site" }));
    await user.click(await screen.findByRole("option", { name: "Finance" }));

    expect(await screen.findByText("Failed to load audit log.")).toBeInTheDocument();
  });

  it("shows the empty state when there are no sites", async () => {
    server.use(
      http.get(`${base}/sites`, () => HttpResponse.json([])),
    );

    renderAuditLog();

    expect(await screen.findByText("No sites are available.")).toBeInTheDocument();
  });

  it("shows an error when the sites fail to load", async () => {
    server.use(
      http.get(`${base}/sites`, () => new HttpResponse(null, { status: 500 })),
    );

    renderAuditLog();

    expect(await screen.findByText("Failed to load sites.")).toBeInTheDocument();
  });
});
