import { http, HttpResponse } from "msw";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/server";
import { AdminStorage, formatBytes } from "./storage";

const base = "http://localhost:5080/api/v1";

function renderStorage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminStorage />
    </QueryClientProvider>,
  );
}

describe("AdminStorage", () => {
  it("shows a loading indicator, then usage per site with a total", async () => {
    server.use(
      http.get(`${base}/admin/storage`, () =>
        HttpResponse.json([
          { siteId: "s1", siteName: "Finance", usedBytes: 500 },
          { siteId: "s2", siteName: "Legal", usedBytes: 1536 },
          { siteId: "s3", siteName: "Marketing", usedBytes: 5 * 1024 * 1024 },
          { siteId: "s4", siteName: "HR", usedBytes: 2 * 1024 * 1024 * 1024 },
        ]),
      ),
    );

    renderStorage();

    expect(screen.getByText("Loading.")).toBeInTheDocument();

    expect(await screen.findByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("500 B")).toBeInTheDocument();
    expect(screen.getByText("1.5 KB")).toBeInTheDocument();
    expect(screen.getByText("5.0 MB")).toBeInTheDocument();
    expect(screen.getAllByText("2.0 GB").length).toBeGreaterThan(0);
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("sums the total across sites", async () => {
    server.use(
      http.get(`${base}/admin/storage`, () =>
        HttpResponse.json([
          { siteId: "s1", siteName: "Finance", usedBytes: 1 * 1024 * 1024 },
          { siteId: "s2", siteName: "Legal", usedBytes: 2 * 1024 * 1024 },
          { siteId: "s3", siteName: "Marketing", usedBytes: 512 * 1024 },
        ]),
      ),
    );

    renderStorage();

    expect((await screen.findAllByText("3.5 MB")).length).toBe(2);
  });

  it("renders a relative usage bar per site", async () => {
    server.use(
      http.get(`${base}/admin/storage`, () =>
        HttpResponse.json([
          { siteId: "s1", siteName: "Finance", usedBytes: 1024 },
          { siteId: "s2", siteName: "Legal", usedBytes: 4096 },
        ]),
      ),
    );

    renderStorage();

    const biggest = await screen.findByRole("progressbar", { name: "Legal usage" });
    expect(biggest).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByRole("progressbar", { name: "Finance usage" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
  });

  it("shows the empty state when there is no data", async () => {
    server.use(
      http.get(`${base}/admin/storage`, () => HttpResponse.json([])),
    );

    renderStorage();

    expect(await screen.findByText("No storage data available.")).toBeInTheDocument();
  });

  it("shows an error when the report fails to load", async () => {
    server.use(
      http.get(`${base}/admin/storage`, () => new HttpResponse(null, { status: 500 })),
    );

    renderStorage();

    expect(await screen.findByText("Failed to load storage report.")).toBeInTheDocument();
  });

  it("formats bytes across every unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });
});
