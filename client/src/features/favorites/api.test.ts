import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import type { FavoriteItemDto } from "@/types/api";
import { addFavorite, listFavorites, removeFavorite } from "./api";

const base = "http://localhost:5080/api/v1";

describe("favorites api", () => {
  it("lists favorites", async () => {
    const items: FavoriteItemDto[] = [
      {
        objectId: "s1",
        objectType: "Site",
        name: "Site One",
        location: "Site One",
        siteSlug: "site-one",
        libraryId: null,
        folderId: null,
      },
    ];
    server.use(http.get(`${base}/me/favorites`, () => HttpResponse.json(items)));

    await expect(listFavorites()).resolves.toEqual(items);
  });

  it("adds and removes a favorite", async () => {
    let added = false;
    server.use(
      http.post(`${base}/Document/objects/d1/favorite`, () => {
        added = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`${base}/Document/objects/d1/favorite`, () => {
        added = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(addFavorite("Document", "d1")).resolves.toBeUndefined();
    expect(added).toBe(true);
    await expect(removeFavorite("Document", "d1")).resolves.toBeUndefined();
    expect(added).toBe(false);
  });
});
