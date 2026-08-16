import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiCreateUser,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("share dialog", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  let fileName: string;
  let userEmail: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Share");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    fileName = `share-me-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "share me");
    userEmail = `sharee-${Date.now()}@e2e.local`;
    await apiCreateUser(request, session.token, userEmail);
    await request.dispose();
  });

  test("share a document with another user through the dialog", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: fileName, exact: true })
      .click();
    await expect(session.page.getByRole("heading", { name: fileName, exact: true })).toBeVisible();

    await session.page.getByRole("button", { name: "Share", exact: true }).click();
    const shareDialog = session.page.locator('[data-slot="dialog-content"]');
    await expect(
      shareDialog.getByRole("heading", { name: new RegExp(`Share.*${fileName}`) }),
    ).toBeVisible();

    await shareDialog.locator("#share-user").click();
    await session.page.getByRole("option", { name: new RegExp(userEmail) }).click();
    await shareDialog.getByRole("button", { name: "Share", exact: true }).click();

    await expect(session.page.getByText("Document shared")).toBeVisible();
    await expect(session.page.locator('[data-slot="dialog-content"]')).toHaveCount(0);
  });
});
