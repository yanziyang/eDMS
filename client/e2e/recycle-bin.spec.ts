import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("recycle bin restore", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  const fileName = `recycle-me-${Date.now()}.txt`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Recycle");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    await apiUpload(request, session.token, libraryId, fileName, "delete me");
    await request.dispose();
  });

  test("delete via the library UI, restore from the recycle bin", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();

    await session.page.getByRole("button", { name: `Delete ${fileName}` }).click();
    await expect(session.page.locator("tr", { hasText: fileName })).toHaveCount(0);

    await session.page.goto(`/recycle-bin/${siteSlug}`);
    const row = session.page.locator("tr", { hasText: fileName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Restore", exact: true }).click();

    await expect(session.page.getByText("Item restored")).toBeVisible();
    await expect(row).toHaveCount(0);

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });
});
