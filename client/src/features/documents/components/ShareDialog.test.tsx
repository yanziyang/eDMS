import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import type { ShareLinkDto } from "@/types/api";
import { ShareDialog } from "./ShareDialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";
const shareUrl = `${base}/Document/objects/d1/share`;
const createLinkUrl = `${base}/Document/objects/d1/share-links`;
const listLinksUrl = `${base}/Document/objects/d1/share-links`;

function userDto(overrides: Record<string, unknown> = {}) {
  return {
    id: "u2",
    email: "bob@example.com",
    displayName: "Bob Jones",
    isActive: true,
    isSystemAdmin: false,
    createdAt: "2026-01-01T00:00:00Z",
    lastLoginAt: null,
    ...overrides,
  };
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ShareDialog open onOpenChange={onOpenChange} documentId="d1" documentName="contract.pdf" />
    </QueryClientProvider>,
  );
  return { ...utils, onOpenChange };
}

async function pickUser(user: ReturnType<typeof userDto>) {
  const userEventInstance = userEvent.setup();
  await userEventInstance.click(await screen.findByRole("combobox", { name: "Person" }));
  await userEventInstance.click(
    await screen.findByRole("option", { name: `${user.displayName} (${user.email})` }),
  );
  return userEventInstance;
}

describe("ShareDialog", () => {
  afterEach(() => {
    delete (window.navigator as { clipboard?: unknown }).clipboard;
    delete (document as { execCommand?: unknown }).execCommand;
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows a loading state for the user list", async () => {
    server.use(
      http.get(`${base}/users`, () => new Promise<Response>(() => {})),
    );

    renderDialog();

    expect(screen.getByText('Share "contract.pdf"')).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("shows an error state when the user list fails to load", async () => {
    server.use(
      http.get(`${base}/users`, () => new HttpResponse(null, { status: 500 })),
    );

    renderDialog();

    expect(await screen.findByText("Failed to load users.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });

  it("renders the user list and defaults", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
    );

    const user = userEvent.setup();
    renderDialog();
    await screen.findByText('Share "contract.pdf"');

    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();

    await user.click(await screen.findByRole("combobox", { name: "Person" }));

    expect(
      await screen.findByRole("option", { name: "Bob Jones (bob@example.com)" }),
    ).toBeInTheDocument();
  });

  it("shows a placeholder for an empty user list", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderDialog();
    await screen.findByText("Select a user");

    await user.click(screen.getByRole("combobox", { name: "Person" }));

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("shares with the selected user and level", async () => {
    const requests: Request[] = [];
    let resolveShare!: (response: Response) => void;
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(shareUrl, async ({ request }) => {
        requests.push(request);
        return new Promise<Response>((resolve) => {
          resolveShare = resolve;
        });
      }),
    );

    const { onOpenChange } = renderDialog();
    const user = await pickUser(userDto());

    await user.click(screen.getByRole("combobox", { name: "Permission level" }));
    await user.click(await screen.findByRole("option", { name: "Contribute" }));
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Share" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolveShare(new HttpResponse(null, { status: 204 }));

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("Document shared"),
    );
    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      principalId: "u2",
      level: "Contribute",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast and keeps the dialog open when sharing fails", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.post(shareUrl, () => new HttpResponse(null, { status: 500 })),
    );

    const { onOpenChange } = renderDialog();
    const user = await pickUser(userDto());

    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(mockedToast.error).toHaveBeenCalledWith("Failed to share document"),
    );
    expect(screen.getByText('Share "contract.pdf"')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancels the dialog", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([])),
    );

    const { onOpenChange } = renderDialog();
    await screen.findByText("Select a user");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit when no user is selected", async () => {
    let posts = 0;
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([])),
      http.post(shareUrl, () => {
        posts += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderDialog();
    await screen.findByText("Select a user");

    const shareButton = screen.getByRole("button", { name: "Share" });
    expect(shareButton).toBeDisabled();
    fireEvent.click(shareButton);

    await waitFor(() => expect(posts).toBe(0));
  });

  it("creates a Read share link, shows the generated URL, and lists active links", async () => {
    const requests: Request[] = [];
    const links: ShareLinkDto[] = [];
    const created: ShareLinkDto = { id: "l1", token: "tok-abc", level: "Read", expiresAt: null };
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json(links)),
      http.post(createLinkUrl, async ({ request }) => {
        requests.push(request);
        links.push({ id: "l2", token: "tok-xyz", level: "Read", expiresAt: null });
        return HttpResponse.json(created);
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));

    const urlInput = await screen.findByRole("textbox", { name: "Share link URL" });
    expect(urlInput).toHaveValue(`${window.location.origin}/share/tok-abc`);
    await expect(requests[0].json()).resolves.toEqual({ level: "Read" });
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Link created"));
    expect(await screen.findByText("Never expires")).toBeInTheDocument();
  });

  it("sends the selected expiry when creating a link", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json({
          id: "l1",
          token: "tok-1",
          level: "Read",
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        });
      }),
    );

    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("combobox", { name: "Expires in" }));
    await user.click(await screen.findByRole("option", { name: "1 day" }));
    await user.click(await screen.findByRole("button", { name: "Create link" }));

    await waitFor(() => expect(requests).toHaveLength(1));
    const body = (await requests[0].json()) as { level: string; expiresAt?: string };
    expect(body.level).toBe("Read");
    expect(body.expiresAt).toBeDefined();
    const diff = new Date(body.expiresAt!).getTime() - Date.now();
    expect(Math.abs(diff - 86_400_000)).toBeLessThan(60_000);

    const urlInput = await screen.findByRole("textbox", { name: "Share link URL" });
    expect(urlInput).toHaveValue(`${window.location.origin}/share/tok-1`);
  });

  it("copies the share link URL to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, () =>
        HttpResponse.json({ id: "l1", token: "tok-abc", level: "Read", expiresAt: null }),
      ),
    );

    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));
    await screen.findByRole("textbox", { name: "Share link URL" });
    await user.click(screen.getByRole("button", { name: "Copy share link" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/tok-abc`),
    );
    expect(mockedToast.success).toHaveBeenCalledWith("Link copied");
  });

  it("lists active links and revokes one", async () => {
    let links: ShareLinkDto[] = [
      { id: "l1", token: "tok-1", level: "Read", expiresAt: null },
      { id: "l2", token: "tok-2", level: "Read", expiresAt: "2026-09-01T00:00:00Z" },
    ];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json(links)),
      http.delete(`${base}/share-links/l1`, () => {
        links = links.filter((link) => link.id !== "l1");
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderDialog();

    const expiringRow = () =>
      screen.getByRole("button", { name: "Revoke link l2" }).closest("li") as HTMLElement;
    expect(await screen.findByText("Never expires")).toBeInTheDocument();
    expect(expiringRow()).toHaveTextContent("Expires");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Revoke link l1" }));

    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Link revoked"));
    await waitFor(() => expect(screen.queryByText("Never expires")).not.toBeInTheDocument());
    expect(expiringRow()).toHaveTextContent("Expires");
  });

  it("falls back to a textarea when the clipboard is unavailable", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, () =>
        HttpResponse.json({ id: "l1", token: "tok-abc", level: "Read", expiresAt: null }),
      ),
    );

    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));
    await screen.findByRole("textbox", { name: "Share link URL" });
    await user.click(screen.getByRole("button", { name: "Copy share link" }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Link copied"));
  });

  it("uses execCommand when it is available in the fallback", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const execCommand = vi.fn();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, () =>
        HttpResponse.json({ id: "l1", token: "tok-abc", level: "Read", expiresAt: null }),
      ),
    );

    const user = userEvent.setup();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));
    await screen.findByRole("textbox", { name: "Share link URL" });
    await user.click(screen.getByRole("button", { name: "Copy share link" }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    await waitFor(() => expect(mockedToast.success).toHaveBeenCalledWith("Link copied"));
  });

  it("shows a spinner on the create-link button while the request is in flight", async () => {
    let resolveCreate!: (response: Response) => void;
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, () =>
        new Promise<Response>((resolve) => {
          resolveCreate = resolve;
        }),
      ),
    );

    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create link" }).querySelector(".animate-spin"),
      ).toBeInTheDocument(),
    );
    resolveCreate(HttpResponse.json({ id: "l1", token: "tok-1", level: "Read", expiresAt: null }));
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Share link URL" })).toBeInTheDocument(),
    );
  });

  it("shows an error toast when revoking a link fails", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () =>
        HttpResponse.json([{ id: "l1", token: "tok-1", level: "Read", expiresAt: null }]),
      ),
      http.delete(`${base}/share-links/l1`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderDialog();

    await screen.findByText("Never expires");
    await user.click(screen.getByRole("button", { name: "Revoke link l1" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to revoke link"));
  });

  it("shows an error toast when creating a link fails", async () => {
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json([userDto()])),
      http.get(listLinksUrl, () => HttpResponse.json([])),
      http.post(createLinkUrl, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderDialog();

    await user.click(await screen.findByRole("button", { name: "Create link" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to create link"));
    expect(screen.queryByRole("textbox", { name: "Share link URL" })).not.toBeInTheDocument();
  });
});
