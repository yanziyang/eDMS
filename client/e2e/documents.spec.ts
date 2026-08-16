import { test, expect } from "@playwright/test";
import { ADMIN, apiCreateSite, apiGetDefaultLibrary, apiLogin, loginUi } from "./helpers";

test.describe.serial("document lifecycle", () => {
  let siteSlug: string;
  let libraryId: string;
  const fileName = `e2e-doc-${Date.now()}.txt`;

  test.beforeAll(async ({ playwright }) => {
    const request = await playwright.request.newContext();
    const token = await apiLogin(request);
    const site = await apiCreateSite(request, token, "E2E Documents");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, token, site.id);
    await request.dispose();
  });

  test("upload a file through the UI and see it listed", async ({ page }) => {
    await loginUi(page);
    await page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("e2e upload content"),
    });

    await expect(page.locator("td", { hasText: fileName })).toBeVisible();
  });

  test("search finds the uploaded document", async ({ page }) => {
    await loginUi(page);
    await page.goto("/search");

    await page.getByPlaceholder(/Search documents/).fill(fileName);
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByText(fileName)).toBeVisible();
  });

  test("download the current version with auth", async ({ page }) => {
    await loginUi(page);
    await page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);

    const downloadPromise = page.waitForEvent("download");
    await page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: /Download/ })
      .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(fileName);
  });
});
