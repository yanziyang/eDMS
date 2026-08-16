import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("document details sheet", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  let renamedFile: string;
  const fileName = `details-${Date.now()}.txt`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Details");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    await apiUpload(request, session.token, libraryId, fileName, "v1 content");
    await apiUpload(request, session.token, libraryId, fileName, "v2 content");
    renamedFile = fileName.replace(".txt", "-renamed.txt");
    await request.dispose();
  });

  async function openSheet(name: string) {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page
      .locator("tr", { hasText: name })
      .getByRole("button", { name, exact: true })
      .click();
    await expect(session.page.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  test("rename a document from the Properties tab", async () => {
    await openSheet(fileName);
    await session.page.locator("#doc-name").fill(renamedFile);
    await session.page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(session.page.getByText("Document updated")).toBeVisible();
    await session.page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);

    await expect(session.page.locator("tr", { hasText: renamedFile })).toBeVisible();
    await expect(session.page.locator("tr", { hasText: fileName })).toHaveCount(0);
  });

  test("Versions tab lists versions and restore works", async () => {
    await openSheet(renamedFile);
    await session.page.getByRole("tab", { name: "Versions" }).click();

    const versionsTable = session.page.locator('[data-slot="sheet-content"] tbody');
    await expect(versionsTable.locator("tr")).toHaveCount(2);
    await expect(session.page.getByText("Current").first()).toBeVisible();

    await session.page.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(session.page.getByText("Version restored")).toBeVisible();
    await expect(versionsTable.locator("tr")).toHaveCount(3);
  });

  test("check out and check in from the sheet", async () => {
    await openSheet(renamedFile);
    await session.page.getByRole("tab", { name: "Versions" }).click();

    await session.page.getByRole("button", { name: "Check out", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Check in", exact: true })).toBeVisible();
    await expect(
      session.page.locator('[data-sonner-toast]', { hasText: "Checked out" }),
    ).toBeVisible();

    await session.page.locator("#checkin-comment").fill("e2e check-in");
    await session.page.getByRole("button", { name: "Check in", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Check out", exact: true })).toBeVisible();
    await expect(
      session.page.locator('[data-sonner-toast]', { hasText: "Checked in" }),
    ).toBeVisible();

    await session.page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      session.page.locator("tr", { hasText: renamedFile }).getByText("Checked out"),
    ).toHaveCount(0);
  });
});
