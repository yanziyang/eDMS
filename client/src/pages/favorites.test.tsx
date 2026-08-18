import { http, HttpResponse } from "msw";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { Favorites } from "./favorites";

const base = "http://localhost:5080/api/v1";

function renderFavorites() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Favorites />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Favorites", () => {
  it("groups all favorite object types and links to each real target", async () => {
    server.use(
      http.get(`${base}/me/favorites`, () =>
        HttpResponse.json([
          {
            objectId: "s1",
            objectType: "Site",
            name: "Site One",
            location: "Site One",
            siteSlug: "site-one",
            libraryId: null,
            folderId: null,
          },
          {
            objectId: "l1",
            objectType: "Library",
            name: "Documents",
            location: "Site One / Documents",
            siteSlug: "site-one",
            libraryId: "l1",
            folderId: null,
          },
          {
            objectId: "f1",
            objectType: "Folder",
            name: "Policies",
            location: "Site One / Documents / Policies",
            siteSlug: "site-one",
            libraryId: "l1",
            folderId: "f1",
          },
          {
            objectId: "d1",
            objectType: "Document",
            name: "contract.pdf",
            location: "Site One / Documents",
            siteSlug: "site-one",
            libraryId: "l1",
            folderId: null,
          },
        ]),
      ),
    );

    renderFavorites();

    expect(await screen.findByRole("heading", { name: "Favorites" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sites" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Libraries" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Folders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Site One Site One" })).toHaveAttribute(
      "href",
      "/sites/site-one",
    );
    expect(screen.getByRole("link", { name: "Documents Site One / Documents" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1",
    );
    expect(screen.getByRole("link", { name: "Policies Site One / Documents / Policies" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1?folderId=f1",
    );
    expect(screen.getByRole("link", { name: "contract.pdf Site One / Documents" })).toHaveAttribute(
      "href",
      "/sites/site-one/libraries/l1?documentId=d1",
    );
  });

  it("shows the empty state", async () => {
    server.use(http.get(`${base}/me/favorites`, () => HttpResponse.json([])));

    renderFavorites();

    expect(await screen.findByText("You have no favorites yet.")).toBeInTheDocument();
  });

  it("shows an error when favorites cannot be loaded", async () => {
    server.use(http.get(`${base}/me/favorites`, () => new HttpResponse(null, { status: 500 })));

    renderFavorites();

    expect(await screen.findByText("Failed to load favorites.")).toBeInTheDocument();
  });

  it("removes a document favorite from its context menu", async () => {
    let deletes = 0;
    const items: unknown[] = [
      {
        objectId: "d1",
        objectType: "Document",
        name: "contract.pdf",
        location: "Site One / Documents",
        siteSlug: "site-one",
        libraryId: "l1",
        folderId: null,
      },
    ];
    server.use(
      http.get(`${base}/me/favorites`, () => HttpResponse.json(items)),
      http.delete(`${base}/Document/objects/d1/favorite`, () => {
        deletes += 1;
        items.length = 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { default: userEvent } = await import("@testing-library/user-event");
    renderFavorites();

    const row = await screen.findByText("contract.pdf");
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Unfavorite" }));

    await screen.findByText("You have no favorites yet.");
    expect(deletes).toBe(1);
  });

  it("navigates to a document favorite from its context menu", async () => {
    server.use(
      http.get(`${base}/me/favorites`, () =>
        HttpResponse.json([
          {
            objectId: "d1",
            objectType: "Document",
            name: "contract.pdf",
            location: "Site One / Documents",
            siteSlug: "site-one",
            libraryId: "l1",
            folderId: null,
          },
        ]),
      ),
    );

    const { default: userEvent } = await import("@testing-library/user-event");
    renderFavorites();

    const row = await screen.findByText("contract.pdf");
    fireEvent.contextMenu(row);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Open" }));

    expect(
      screen.getByRole("link", { name: "contract.pdf Site One / Documents" }),
    ).toHaveAttribute("href", "/sites/site-one/libraries/l1?documentId=d1");
  });
});
