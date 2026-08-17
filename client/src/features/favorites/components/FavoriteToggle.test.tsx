import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { server } from "@/test/server";
import { FavoriteToggle } from "./FavoriteToggle";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedToast = vi.mocked(toast);
const base = "http://localhost:5080/api/v1";

function renderToggle(itemName?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <FavoriteToggle objectType="Document" objectId="d1" itemName={itemName} />
    </QueryClientProvider>,
  );
}

describe("FavoriteToggle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds an item that is not currently favorited", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/me/favorites`, () => HttpResponse.json([])),
      http.post(`${base}/Document/objects/d1/favorite`, ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderToggle("Contract.pdf");
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Add to favorites: Contract.pdf" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Added to favorites");
  });

  it("removes an item that is already favorited", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(`${base}/me/favorites`, () =>
        HttpResponse.json([{ objectId: "d1", objectType: "Document" }]),
      ),
      http.delete(`${base}/Document/objects/d1/favorite`, ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderToggle();
    const user = userEvent.setup();
    const button = await screen.findByRole("button", { name: "Remove from favorites" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await user.click(button);

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(mockedToast.success).toHaveBeenCalledWith("Removed from favorites");
  });

  it("reports a failed favorite update", async () => {
    server.use(
      http.get(`${base}/me/favorites`, () => HttpResponse.json([])),
      http.post(`${base}/Document/objects/d1/favorite`, () => new HttpResponse(null, { status: 500 })),
    );

    renderToggle();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Add to favorites" }));

    await waitFor(() => expect(mockedToast.error).toHaveBeenCalledWith("Failed to update favorites"));
  });
});
