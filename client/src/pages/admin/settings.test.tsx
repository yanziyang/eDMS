import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { AdminSettings } from "./settings";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function settingsDto(overrides: Record<string, unknown> = {}) {
  return {
    maxUploadSizeBytes: 250 * 1024 * 1024,
    recycleBinRetentionDays: 90,
    siteCreationRestricted: false,
    accessTokenLifetimeMinutes: 15,
    refreshTokenLifetimeDays: 7,
    appName: "eDMS",
    ssoEnforcedGlobally: false,
    ...overrides,
  };
}

function renderSettings() {
  server.use(
    http.get(`${base}/auth/sso/providers`, () =>
      HttpResponse.json({ oidc: false, saml: false })),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AdminSettings />
      </QueryClientProvider>,
    ),
  };
}

describe("AdminSettings", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("shows a loading indicator, then the form populated from the settings", async () => {
    server.use(
      http.get(`${base}/admin/settings`, () => HttpResponse.json(settingsDto())),
    );

    renderSettings();

    expect(screen.getByText("Loading.")).toBeInTheDocument();
    expect(
      await screen.findByLabelText("Max file size (MB)"),
    ).toHaveValue(250);
    expect(screen.getByLabelText("Recycle Bin retention (days)")).toHaveValue(90);
    expect(screen.getByRole("switch", { name: "Restrict site creation" })).not.toBeChecked();
    expect(screen.getByText("eDMS")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("saves edited values as a partial update and refetches the settings", async () => {
    const requests: Request[] = [];
    let gets = 0;
    server.use(
      http.get(`${base}/admin/settings`, () => {
        gets += 1;
        return HttpResponse.json(settingsDto());
      }),
      http.put(`${base}/admin/settings`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText("Max file size (MB)");

    await user.clear(screen.getByLabelText("Max file size (MB)"));
    await user.type(screen.getByLabelText("Max file size (MB)"), "500");
    await user.clear(screen.getByLabelText("Recycle Bin retention (days)"));
    await user.type(screen.getByLabelText("Recycle Bin retention (days)"), "30");
    await user.click(screen.getByRole("switch", { name: "Restrict site creation" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    await expect(requests[0].json()).resolves.toEqual({
      maxUploadSizeBytes: 500 * 1024 * 1024,
      recycleBinRetentionDays: 30,
      siteCreationRestricted: true,
      ssoEnforcedGlobally: false,
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Settings saved");
    await waitFor(() => expect(gets).toBe(2));
  });

  it("disables the save button while submitting", async () => {
    let resolvePut!: (response: Response) => void;
    server.use(
      http.get(`${base}/admin/settings`, () => HttpResponse.json(settingsDto())),
      http.put(`${base}/admin/settings`, () => new Promise<Response>((resolve) => {
        resolvePut = resolve;
      })),
    );

    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText("Max file size (MB)");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled(),
    );
    resolvePut(new HttpResponse(null, { status: 204 }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toBeEnabled(),
    );
  });

  it("disables the save button while the form values are invalid", async () => {
    server.use(
      http.get(`${base}/admin/settings`, () => HttpResponse.json(settingsDto())),
    );

    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText("Max file size (MB)");

    await user.clear(screen.getByLabelText("Max file size (MB)"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(screen.getByLabelText("Max file size (MB)"), "0");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("reports a failed save", async () => {
    server.use(
      http.get(`${base}/admin/settings`, () => HttpResponse.json(settingsDto())),
      http.put(`${base}/admin/settings`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText("Max file size (MB)");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to save settings"));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows an error when the settings fail to load", async () => {
    server.use(
      http.get(`${base}/admin/settings`, () => new HttpResponse(null, { status: 500 })),
    );

    renderSettings();

    expect(await screen.findByText("Failed to load settings.")).toBeInTheDocument();
  });

  it("shows the empty state when no settings are returned", async () => {
    server.use(
      http.get(`${base}/admin/settings`, () => HttpResponse.json(null)),
    );

    renderSettings();

    expect(await screen.findByText("No settings are available.")).toBeInTheDocument();
  });
});
