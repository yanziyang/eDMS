import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { Search } from "./search";

const base = "http://localhost:5080/api/v1";

function renderSearch() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Search />
    </QueryClientProvider>,
  );
}

describe("Search", () => {
  it("renders the form and initial state", () => {
    renderSearch();

    expect(screen.getByRole("heading", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search documents…")).toBeInTheDocument();
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });

  it("does nothing for a blank query", async () => {
    let calls = 0;
    server.use(
      http.get(`${base}/search`, () => {
        calls += 1;
        return HttpResponse.json([]);
      }),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText("Search documents…"), "   ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(calls).toBe(0));
  });

  it("searches and renders results", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/search`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([
          { documentId: "d1", name: "contract.pdf", sizeBytes: 10, siteId: "s1", libraryId: "l1", folderPath: "/Legal", modifiedAt: "2026-03-01T00:00:00Z" },
          { documentId: "d2", name: "policy.docx", sizeBytes: 10, siteId: "s1", libraryId: "l1", folderPath: null, modifiedAt: "2026-02-01T00:00:00Z" },
        ]);
      }),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText("Search documents…"), " contract ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText("policy.docx")).toBeInTheDocument();
    expect(screen.getByText(/\/Legal/)).toBeInTheDocument();
    expect(urls[0]).toContain("q=contract");
  });

  it("shows the no-results message for an empty result set", async () => {
    server.use(
      http.get(`${base}/search`, () => HttpResponse.json([])),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText("Search documents…"), "nothing");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("No results.")).toBeInTheDocument());
  });

  it("stops loading when the search fails", async () => {
    server.use(
      http.get(`${base}/search`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderSearch();

    await user.type(screen.getByPlaceholderText("Search documents…"), "boom");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Search" })).toBeEnabled());
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
