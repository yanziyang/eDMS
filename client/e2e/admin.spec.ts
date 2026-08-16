import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("admin pages", () => {
  let session: AdminSession;
  let siteName: string;
  const fileName = `admin-doc-${Date.now()}.txt`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    siteName = `E2E Admin ${Date.now()}`;
    const site = await apiCreateSite(request, session.token, siteName);
    const libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    await apiUpload(request, session.token, libraryId, fileName, "admin audit");
    await request.dispose();
  });

  test("settings form loads with values", async () => {
    await session.page.goto("/admin/settings");

    await expect(session.page.getByRole("heading", { name: "Admin Center" })).toBeVisible();
    await expect(session.page.locator("#max-upload-mb")).toHaveValue(/\d+/);
    await expect(session.page.locator("#retention-days")).toHaveValue(/\d+/);
    await expect(session.page.getByText("Application name")).toBeVisible();
    await expect(
      session.page.getByRole("switch", { name: "Restrict site creation" }),
    ).toBeVisible();
  });

  test("storage report table renders", async () => {
    await session.page.goto("/admin/storage");

    await expect(session.page.getByText("Total storage used")).toBeVisible();
    await expect(session.page.locator("tbody tr", { hasText: siteName })).toBeVisible();
    await expect(session.page.locator("tbody tr", { hasText: "Total" })).toBeVisible();
  });

  test("audit log shows rows for a selected site", async () => {
    await session.page.goto("/admin/audit-log");

    await session.page.locator("#audit-site").click();
    await session.page.getByRole("option", { name: siteName }).click();

    await expect(session.page.locator("tbody tr").first()).toBeVisible();
    await expect(session.page.locator("tbody tr", { hasText: fileName })).toBeVisible();
  });
});
