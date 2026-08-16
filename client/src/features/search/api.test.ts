import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import { search } from "./api";

const base = "http://localhost:5080/api/v1";

describe("search api", () => {
  it("encodes the query and returns results", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/search`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([{ documentId: "d1", name: "contract.pdf" }]);
      }),
    );

    const result = await search("contract & agreement");

    expect(result).toEqual([{ documentId: "d1", name: "contract.pdf" }]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("q=contract%20%26%20agreement");
  });
});
