import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/server";
import type { UploadSessionDto } from "@/types/api";
import { uploadChunks } from "./chunkedUpload";

const base = "http://localhost:5080/api/v1";

function session(overrides: Partial<UploadSessionDto> = {}): UploadSessionDto {
  return {
    sessionId: "s1",
    fileName: "big.bin",
    totalBytes: 25,
    uploadedBytes: 0,
    chunkSize: 10,
    expiresAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("uploadChunks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("appends sequentially sliced chunks and reports progress", async () => {
    let uploadedBytes = 0;
    const requests: { offset: number; bytes: number }[] = [];
    const bodies: Uint8Array[] = [];
    server.use(
      http.get(`${base}/uploads/s1`, () => HttpResponse.json(session())),
      http.put(`${base}/uploads/s1/chunks`, async ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        expect(offset).toBe(uploadedBytes);
        const body = new Uint8Array(await request.arrayBuffer());
        requests.push({ offset, bytes: body.byteLength });
        bodies.push(body);
        uploadedBytes += body.byteLength;
        return HttpResponse.json(session({ uploadedBytes }));
      }),
    );

    const bytes = Array.from({ length: 25 }, (_, index) => index + 1);
    const file = new File([new Uint8Array(bytes)], "big.bin");
    const progress: { uploadedBytes: number; totalBytes: number }[] = [];
    const result = await uploadChunks(file, "s1", (p) => progress.push(p));

    expect(requests).toEqual([
      { offset: 0, bytes: 10 },
      { offset: 10, bytes: 10 },
      { offset: 20, bytes: 5 },
    ]);
    expect(bodies[0]).toEqual(new Uint8Array(bytes.slice(0, 10)));
    expect(bodies[1]).toEqual(new Uint8Array(bytes.slice(10, 20)));
    expect(bodies[2]).toEqual(new Uint8Array(bytes.slice(20, 25)));
    expect(progress).toEqual([
      { uploadedBytes: 0, totalBytes: 25 },
      { uploadedBytes: 10, totalBytes: 25 },
      { uploadedBytes: 20, totalBytes: 25 },
      { uploadedBytes: 25, totalBytes: 25 },
    ]);
    expect(result.uploadedBytes).toBe(25);
  });

  it("resumes from the server-reported offset without re-sending chunks", async () => {
    let uploadedBytes = 10;
    const offsets: number[] = [];
    server.use(
      http.get(`${base}/uploads/s1`, () => HttpResponse.json(session({ uploadedBytes: 10 }))),
      http.put(`${base}/uploads/s1/chunks`, async ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get("offset"));
        offsets.push(offset);
        const body = await request.arrayBuffer();
        uploadedBytes += body.byteLength;
        return HttpResponse.json(session({ uploadedBytes }));
      }),
    );

    const file = new File([new Uint8Array(25)], "big.bin");
    const progress: { uploadedBytes: number; totalBytes: number }[] = [];
    await uploadChunks(file, "s1", (p) => progress.push(p));

    expect(offsets).toEqual([10, 20]);
    expect(progress[0]).toEqual({ uploadedBytes: 10, totalBytes: 25 });
    expect(progress.at(-1)).toEqual({ uploadedBytes: 25, totalBytes: 25 });
  });

  it("propagates 409 offset-conflict responses", async () => {
    server.use(
      http.get(`${base}/uploads/s1`, () => HttpResponse.json(session())),
      http.put(`${base}/uploads/s1/chunks`, () =>
        HttpResponse.json({ title: "Conflict", detail: "Offset mismatch" }, { status: 409 }),
      ),
    );

    const file = new File([new Uint8Array(25)], "big.bin");
    await expect(uploadChunks(file, "s1", () => {})).rejects.toMatchObject({ status: 409 });
  });

  it("propagates network errors", async () => {
    server.use(
      http.get(`${base}/uploads/s1`, () => HttpResponse.json(session())),
      http.put(`${base}/uploads/s1/chunks`, () => HttpResponse.error()),
    );

    const file = new File([new Uint8Array(25)], "big.bin");
    await expect(uploadChunks(file, "s1", () => {})).rejects.toThrow();
  });

  it("reports full progress and appends nothing when already fully uploaded", async () => {
    let puts = 0;
    server.use(
      http.get(`${base}/uploads/s1`, () => HttpResponse.json(session({ uploadedBytes: 25 }))),
      http.put(`${base}/uploads/s1/chunks`, () => {
        puts += 1;
        return HttpResponse.json(session({ uploadedBytes: 25 }));
      }),
    );

    const file = new File([new Uint8Array(25)], "big.bin");
    const progress: { uploadedBytes: number; totalBytes: number }[] = [];
    await uploadChunks(file, "s1", (p) => progress.push(p));

    expect(puts).toBe(0);
    expect(progress).toEqual([{ uploadedBytes: 25, totalBytes: 25 }]);
  });

  it("requests a fresh status on every run, including a retry after failure", async () => {
    let checks = 0;
    let uploadedBytes = 0;
    server.use(
      http.get(`${base}/uploads/s1`, () => {
        checks += 1;
        return HttpResponse.json(session({ uploadedBytes }));
      }),
      http.put(`${base}/uploads/s1/chunks`, async ({ request }) => {
        const body = await request.arrayBuffer();
        uploadedBytes += body.byteLength;
        return HttpResponse.json(session({ uploadedBytes }));
      }),
    );

    const file = new File([new Uint8Array(25)], "big.bin");
    await uploadChunks(file, "s1", () => {});
    await uploadChunks(file, "s1", () => {});

    expect(checks).toBe(2);
  });
});
