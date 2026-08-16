import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCheckin,
  apiCheckout,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("checked-out state is reflected in the library UI", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  let documentId: string;
  const fileName = `checkout-${Date.now()}.txt`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Versioning");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    documentId = await apiUpload(request, session.token, libraryId, fileName, "v1");
    await apiCheckout(request, session.token, documentId);
    await request.dispose();
  });

  test("checking out and back in is reflected in the list", async ({ playwright }) => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(
      session.page.locator("tr", { hasText: fileName }).getByText("Checked out"),
    ).toBeVisible();

    const request = await adminRequest(playwright, session.token);
    await apiCheckin(request, session.token, documentId);
    await request.dispose();

    await session.page.reload();
    await expect(
      session.page.locator("tr", { hasText: fileName }).getByText("Checked out"),
    ).toHaveCount(0);
  });
});
