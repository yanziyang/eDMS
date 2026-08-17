import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { listRecent } from "./api";

const base = "http://localhost:5080/api/v1";

describe("recent api", () => {
  it("lists audit-derived recent documents", async () => {
    const recent = [
      {
        documentId: "d1",
        name: "Contract.pdf",
        siteId: "s1",
        siteName: "Site One",
        siteSlug: "site-one",
        libraryId: "l1",
        libraryName: "Documents",
        folderId: null,
        folderPath: null,
        lastTouchedAt: "2026-08-17T10:00:00Z",
        lastAction: "View",
      },
    ];
    server.use(http.get(`${base}/me/recent`, () => HttpResponse.json(recent)));

    await expect(listRecent()).resolves.toEqual(recent);
  });
});
