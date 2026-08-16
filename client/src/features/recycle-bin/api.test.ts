import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  listRecycleBin,
  permanentlyDeleteRecycleBinItem,
  restoreRecycleBinItem,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("recycle-bin api", () => {
  it("listRecycleBin gets the recycle bin for a site", async () => {
    server.use(
      http.get(`${base}/sites/s1/recycle-bin`, () =>
        HttpResponse.json([{ id: "r1", kind: "document", name: "old.pdf" }]),
      ),
    );

    const result = await listRecycleBin("s1");

    expect(result).toEqual([{ id: "r1", kind: "document", name: "old.pdf" }]);
  });

  it("restoreRecycleBinItem posts with the object type", async () => {
    const urls: string[] = [];
    server.use(
      http.post(`${base}/recycle-bin/r1/restore`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await restoreRecycleBinItem("r1", "Document");

    expect(urls[0]).toContain("/recycle-bin/r1/restore");
    expect(urls[0]).toContain("objectType=Document");
  });

  it("restoreRecycleBinItem supports folders", async () => {
    const urls: string[] = [];
    server.use(
      http.post(`${base}/recycle-bin/r2/restore`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await restoreRecycleBinItem("r2", "Folder");

    expect(urls[0]).toContain("objectType=Folder");
  });

  it("permanentlyDeleteRecycleBinItem deletes with the object type", async () => {
    const urls: string[] = [];
    server.use(
      http.delete(`${base}/recycle-bin/r1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await permanentlyDeleteRecycleBinItem("r1", "Document");

    expect(urls[0]).toContain("/recycle-bin/r1");
    expect(urls[0]).toContain("objectType=Document");
  });
});
