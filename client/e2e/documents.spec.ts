import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("document lifecycle", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  const fileName = `e2e-doc-${Date.now()}.txt`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Documents");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    await request.dispose();
  });

  test("upload a file through the UI and see it listed", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await session.page.getByRole("button", { name: "Upload", exact: true }).click();
    await session.page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("e2e upload content"),
    });

    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });

  test("search finds the uploaded document", async () => {
    await session.page.goto("/search");

    await session.page.getByPlaceholder(/Search documents/).fill(fileName);
    await session.page.getByRole("button", { name: "Search" }).click();

    await expect(session.page.getByText(fileName)).toBeVisible();
  });

  test("download the current version with auth", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);

    const downloadPromise = session.page.waitForEvent("download");
    await session.page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: /Download/ })
      .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(fileName);
  });
});
