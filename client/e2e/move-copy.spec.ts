import { test, expect } from "@playwright/test";
import {
  adminRequest,
  apiCreateLibrary,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

test.describe.serial("move and copy via the library UI", () => {
  let session: AdminSession;
  let siteSlug: string;
  let sourceLibraryId: string;
  let targetLibraryId: string;
  const fileName = `move-me-${Date.now()}.txt`;
  const targetLibraryName = `Target ${Date.now()}`;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Move");
    siteSlug = site.slug;
    sourceLibraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    targetLibraryId = await apiCreateLibrary(request, session.token, site.id, targetLibraryName);
    await apiUpload(request, session.token, sourceLibraryId, fileName, "move me");
    await request.dispose();
  });

  test("move a document to another library", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${sourceLibraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();

    await session.page.getByRole("checkbox", { name: `Select ${fileName}` }).check();
    await session.page.getByRole("button", { name: "Move / Copy" }).click();

    await expect(session.page.getByRole("dialog").getByText(/Move or copy/)).toBeVisible();
    await session.page.locator("#dest-library").click();
    await session.page.getByRole("option", { name: targetLibraryName }).click();
    await session.page.getByRole("button", { name: "Move", exact: true }).click();

    await expect(session.page.getByText("Document moved")).toBeVisible();
    await expect(session.page.getByRole("dialog")).toHaveCount(0);
    await expect(session.page.locator("tr", { hasText: fileName })).toHaveCount(0);

    await session.page.goto(`/sites/${siteSlug}/libraries/${targetLibraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });

  test("copy the document back to the original library", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${targetLibraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();

    await session.page.getByRole("checkbox", { name: `Select ${fileName}` }).check();
    await session.page.getByRole("button", { name: "Move / Copy" }).click();

    await expect(session.page.getByRole("dialog").getByText(/Move or copy/)).toBeVisible();
    await session.page.locator("#dest-library").click();
    await session.page.getByRole("option", { name: "Documents" }).click();
    await session.page.getByRole("button", { name: "Copy", exact: true }).click();

    await expect(session.page.getByText("Document copied")).toBeVisible();
    await expect(session.page.getByRole("dialog")).toHaveCount(0);

    await session.page.goto(`/sites/${siteSlug}/libraries/${sourceLibraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });
});
