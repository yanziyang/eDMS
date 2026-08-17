import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { server } from "@/test/server";
import { FollowToggle } from "./FollowToggle";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const base = "http://localhost:5080/api/v1";
const mockedToast = vi.mocked(toast);

function renderToggle(objectType: "Site" | "Library" | "Document", objectId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FollowToggle objectType={objectType} objectId={objectId} itemName="Policies" />
    </QueryClientProvider>,
  );
}

describe("FollowToggle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("follows a site immediately", async () => {
    let body: unknown;
    server.use(
      http.get(`${base}/me/notifications/subscriptions`, () => HttpResponse.json([])),
      http.post(`${base}/Site/objects/s1/follow`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: "sub-1",
          objectType: "Site",
          objectId: "s1",
          objectName: "Site One",
          frequency: "Immediate",
          createdAt: "2026-08-17T00:00:00Z",
        });
      }),
    );

    const user = userEvent.setup();
    renderToggle("Site", "s1");
    await user.click(await screen.findByRole("button", { name: "Follow" }));

    await waitFor(() => expect(body).toEqual({ frequency: "Immediate" }));
    expect(mockedToast.success).toHaveBeenCalledWith("Following site");
  });

  it("changes frequency and unfollows a library", async () => {
    const posts: unknown[] = [];
    let deletes = 0;
    server.use(
      http.get(`${base}/me/notifications/subscriptions`, () =>
        HttpResponse.json([{
          id: "sub-1",
          objectType: "Library",
          objectId: "l1",
          objectName: "Policies",
          frequency: "Daily",
          createdAt: "2026-08-17T00:00:00Z",
        }]),
      ),
      http.post(`${base}/Library/objects/l1/follow`, async ({ request }) => {
        posts.push(await request.json());
        return HttpResponse.json({});
      }),
      http.delete(`${base}/Library/objects/l1/follow`, () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderToggle("Library", "l1");
    expect(await screen.findByRole("combobox", { name: "Alert frequency" })).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Alert frequency" }));
    await user.click(await screen.findByRole("option", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Unfollow" }));

    await waitFor(() => expect(posts).toEqual([{ frequency: "Weekly" }]));
    await waitFor(() => expect(deletes).toBe(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Unfollowed library");
  });

  it("surfaces follow failures", async () => {
    server.use(
      http.get(`${base}/me/notifications/subscriptions`, () => HttpResponse.json([])),
      http.post(`${base}/Document/objects/d1/follow`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderToggle("Document", "d1");
    await user.click(await screen.findByRole("button", { name: "Follow" }));
    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to follow document"));
  });

  it("surfaces unfollow failures", async () => {
    server.use(
      http.get(`${base}/me/notifications/subscriptions`, () =>
        HttpResponse.json([{
          id: "sub-1",
          objectType: "Document",
          objectId: "d1",
          objectName: "Policies",
          frequency: "Immediate",
          createdAt: "2026-08-17T00:00:00Z",
        }]),
      ),
      http.delete(`${base}/Document/objects/d1/follow`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderToggle("Document", "d1");
    await screen.findByRole("button", { name: "Unfollow" });
    await user.click(screen.getByRole("button", { name: "Unfollow" }));
    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to unfollow document"));
  });
});
