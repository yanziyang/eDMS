import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/server";
import {
  addContentTypeColumn,
  createContentType,
  deleteContentType,
  deleteContentTypeColumn,
  getDocumentMetadata,
  listContentTypes,
  parseChoiceOptions,
  updateContentType,
  updateContentTypeColumn,
  updateDocumentMetadata,
} from "./api";

const base = "http://localhost:5080/api/v1";

describe("content-types api", () => {
  it("listContentTypes omits the query for org-wide types", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/admin/content-types`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listContentTypes(null);

    expect(urls[0]).toBe(`${base}/admin/content-types`);
  });

  it("listContentTypes adds an encoded libraryId query", async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${base}/admin/content-types`, ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    await listContentTypes("l 1");

    expect(urls[0]).toContain("libraryId=l%201");
  });

  it("createContentType posts the input and returns the id", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/admin/content-types`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("ct9", { status: 201 });
      }),
    );

    const id = await createContentType({ name: "Invoice", description: "Bills", libraryId: "l1" });

    expect(id).toBe("ct9");
    await expect(requests[0].json()).resolves.toEqual({
      name: "Invoice",
      description: "Bills",
      libraryId: "l1",
    });
  });

  it("updateContentType puts to the type id", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/admin/content-types/ct1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateContentType("ct1", { name: "Invoice", libraryId: null });

    expect(requests[0].url).toContain("/admin/content-types/ct1");
    await expect(requests[0].json()).resolves.toEqual({ name: "Invoice", libraryId: null });
  });

  it("deleteContentType deletes the type", async () => {
    const urls: string[] = [];
    server.use(
      http.delete(`${base}/admin/content-types/ct1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteContentType("ct1");

    expect(urls[0]).toContain("/admin/content-types/ct1");
  });

  it("addContentTypeColumn posts to the type and returns the column id", async () => {
    const requests: Request[] = [];
    server.use(
      http.post(`${base}/admin/content-types/ct1/columns`, async ({ request }) => {
        requests.push(request);
        return HttpResponse.json("col9", { status: 201 });
      }),
    );

    const id = await addContentTypeColumn("ct1", {
      name: "Vendor",
      dataType: "Choice",
      isRequired: true,
      choiceOptions: '["Acme","Globex"]',
      defaultValue: null,
    });

    expect(id).toBe("col9");
    await expect(requests[0].json()).resolves.toEqual({
      name: "Vendor",
      dataType: "Choice",
      isRequired: true,
      choiceOptions: '["Acme","Globex"]',
      defaultValue: null,
    });
  });

  it("updateContentTypeColumn puts to the column id", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/admin/columns/col1`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateContentTypeColumn("col1", {
      name: "Vendor",
      dataType: "Text",
      isRequired: false,
    });

    expect(requests[0].url).toContain("/admin/columns/col1");
    await expect(requests[0].json()).resolves.toEqual({
      name: "Vendor",
      dataType: "Text",
      isRequired: false,
    });
  });

  it("deleteContentTypeColumn deletes the column", async () => {
    const urls: string[] = [];
    server.use(
      http.delete(`${base}/admin/columns/col1`, ({ request }) => {
        urls.push(request.url);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteContentTypeColumn("col1");

    expect(urls[0]).toContain("/admin/columns/col1");
  });

  it("getDocumentMetadata reads the document metadata", async () => {
    server.use(
      http.get(`${base}/documents/d1/metadata`, () =>
        HttpResponse.json({ contentTypeId: "ct1", contentTypeName: "Invoice", columns: [] }),
      ),
    );

    const result = await getDocumentMetadata("d1");

    expect(result.contentTypeId).toBe("ct1");
    expect(result.columns).toEqual([]);
  });

  it("updateDocumentMetadata puts the values", async () => {
    const requests: Request[] = [];
    server.use(
      http.put(`${base}/documents/d1/metadata-values`, async ({ request }) => {
        requests.push(request);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await updateDocumentMetadata("d1", [{ columnDefinitionId: "col1", value: "Acme" }]);

    await expect(requests[0].json()).resolves.toEqual({
      values: [{ columnDefinitionId: "col1", value: "Acme" }],
    });
  });

  it("parseChoiceOptions parses a JSON array of strings", () => {
    expect(parseChoiceOptions('["Acme","Globex"]')).toEqual(["Acme", "Globex"]);
  });

  it("parseChoiceOptions returns an empty list for null, invalid JSON and non-array values", () => {
    expect(parseChoiceOptions(null)).toEqual([]);
    expect(parseChoiceOptions("not json")).toEqual([]);
    expect(parseChoiceOptions('{"a":1}')).toEqual([]);
    expect(parseChoiceOptions("[1,2]")).toEqual([]);
  });
});
