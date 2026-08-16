import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { toast } from "sonner";
import { ShareDialog } from "./ShareDialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";
const shareUrl = `${base}/Document/objects/d1/share`;

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
});
