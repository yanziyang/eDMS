import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  API_BASE,
  adminRequest,
  apiCreateSite,
  apiCreateUser,
  apiGetDefaultLibrary,
  apiLogin,
  apiShare,
  apiUpload,
  getAdminSession,
  loginUiAs,
  type AdminSession,
} from "./helpers";

const AUTH_HEADERS = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe.serial("Phase 4 acceptance flows", () => {
  let session: AdminSession;
  let request: APIRequestContext;
  let siteSlug: string;
  let libraryId: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, `E2E Phase 4 ${Date.now()}`);
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
  });

  test.afterAll(async () => {
    await request?.dispose();
  });

  test("a quota-blocked upload is reported in the UI", async () => {
    const quotaSiteName = `E2E Phase 4 Quota ${Date.now()}`;
    const quotaSite = await apiCreateSite(request, session.token, quotaSiteName);
    const quotaLibraryId = await apiGetDefaultLibrary(request, session.token, quotaSite.id);
    const update = await request.put(`${API_BASE}/sites/${quotaSite.id}`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: { name: quotaSiteName, description: null, storageQuotaBytes: 1 },
    });
    expect(update.status()).toBe(204);

    await session.page.setViewportSize({ width: 1440, height: 900 });
    await session.page.goto(`/sites/${quotaSite.slug}/libraries/${quotaLibraryId}`);
    await session.page.getByRole("button", { name: "Upload", exact: true }).click();
    const fileName = `quota-${Date.now()}.txt`;
    await session.page.locator("#upload-files").setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from("this exceeds the quota"),
    });
    await expect(
      session.page.getByText(
        new RegExp(`Failed to upload ${escapeRegExp(fileName)}: Site "${escapeRegExp(quotaSiteName)}" storage quota exceeded`),
      ),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("favorite and unfavorite complete a real round trip", async () => {
    const fileName = `phase4-favorite-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "favorite me");
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    const row = session.page.locator("tr", { hasText: fileName });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: fileName, exact: true }).click();
    await expect(session.page.getByRole("heading", { name: fileName, exact: true })).toBeVisible();

    const add = session.page.getByRole("button", { name: `Add to favorites: ${fileName}` });
    await expect(add).toHaveAttribute("aria-pressed", "false");
    await add.click();
    const remove = session.page.getByRole("button", { name: "Remove from favorites" });
    await expect(remove).toHaveAttribute("aria-pressed", "true");
    await remove.click();
    await expect(
      session.page.getByRole("button", { name: `Add to favorites: ${fileName}` }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("Home Recent is populated by a real upload activity", async () => {
    const fileName = `phase4-recent-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "recent me");
    await session.page.goto("/");
    await expect(
      session.page.getByRole("heading", { name: "Recent", exact: true }),
    ).toBeVisible();
    await expect(
      session.page.getByRole("link", { name: new RegExp(`^${escapeRegExp(fileName)} `) }),
    ).toBeVisible();
  });

  test("a saved library view can be reapplied after changing the filter", async () => {
    const fileName = `phase4-view-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "view me");
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    const filter = session.page.getByRole("textbox", { name: "Filter items" });
    await filter.fill(fileName);

    await session.page.getByRole("combobox", { name: "Saved view" }).click();
    await session.page.getByRole("option", { name: "Save current as…" }).click();
    const saveDialog = session.page.getByRole("dialog");
    const viewName = `Phase 4 view ${Date.now()}`;
    await saveDialog.getByRole("textbox", { name: "View name" }).fill(viewName);
    await saveDialog.getByRole("button", { name: "Save view", exact: true }).click();
    await expect(session.page.getByText("View saved", { exact: true })).toBeVisible();

    await filter.fill("");
    await session.page.getByRole("combobox", { name: "Saved view" }).click();
    await session.page.getByRole("option", { name: viewName, exact: true }).click();
    await expect(filter).toHaveValue(fileName);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });

  test("following a library surfaces a descendant rename notification", async () => {
    const originalName = `phase4-follow-${Date.now()}.txt`;
    const documentId = await apiUpload(request, session.token, libraryId, originalName, "follow me");
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    await session.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();

    const renamed = `${originalName}.renamed`;
    const update = await request.put(`${API_BASE}/documents/${documentId}`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: { name: renamed, title: null, description: null },
    });
    expect(update.status()).toBe(204);

    const notifications = await request.get(`${API_BASE}/me/notifications`, {
      headers: AUTH_HEADERS(session.token),
    });
    expect(notifications.status()).toBe(200);
    const entries = (await notifications.json()) as Array<{ message: string }>;
    expect(entries.some((entry) => entry.message === `${renamed} was renamed.`)).toBe(true);
  });

  test("bulk metadata edits report updated and rejected documents together", async () => {
    const editableName = `phase4-bulk-editable-${Date.now()}.txt`;
    const lockedName = `phase4-bulk-locked-${Date.now()}.txt`;
    const editableId = await apiUpload(request, session.token, libraryId, editableName, "editable");
    const lockedId = await apiUpload(request, session.token, libraryId, lockedName, "locked");

    const editorEmail = `phase4-editor-${Date.now()}@e2e.local`;
    const editorId = await apiCreateUser(request, session.token, editorEmail, "User123!");
    await apiShare(request, session.token, "Document", lockedId, editorId, "Contribute");
    const editorToken = await apiLogin(request, editorEmail, "User123!");
    const checkout = await request.post(`${API_BASE}/documents/${lockedId}/checkout`, {
      headers: AUTH_HEADERS(editorToken),
    });
    expect(checkout.status()).toBe(204);

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page.getByRole("checkbox", { name: `Select ${editableName}` }).click();
    await session.page.getByRole("checkbox", { name: `Select ${lockedName}` }).click();
    await session.page.getByRole("button", { name: "Edit properties", exact: true }).click();
    const dialog = session.page.getByRole("dialog");
    await dialog.getByRole("checkbox", { name: "Set title" }).click();
    await dialog.getByRole("textbox", { name: "Bulk title" }).fill("Phase 4 bulk title");
    await dialog.getByRole("button", { name: "Apply changes", exact: true }).click();
    await expect(session.page.getByText(/Updated 1; failed 1:/)).toBeVisible({ timeout: 15_000 });

    const updated = await request.get(`${API_BASE}/documents/${editableId}`, {
      headers: AUTH_HEADERS(session.token),
    });
    expect(updated.status()).toBe(200);
    expect(((await updated.json()) as { title: string | null }).title).toBe("Phase 4 bulk title");
  });

  test("a read-only user sees the permission-appropriate context menu", async ({ browser }) => {
    const fileName = `phase4-read-context-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "read only");
    const viewerEmail = `phase4-viewer-${Date.now()}@e2e.local`;
    const viewerId = await apiCreateUser(request, session.token, viewerEmail, "User123!");
    await apiShare(request, session.token, "Library", libraryId, viewerId, "Read");

    const viewerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const viewerPage = await viewerContext.newPage();
    try {
      await loginUiAs(viewerPage, viewerEmail, "User123!");
      await viewerPage.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
      const row = viewerPage.locator("tr", { hasText: fileName });
      await expect(row).toBeVisible();
      await row.click({ button: "right" });
      const menu = viewerPage.getByRole("menu");
      await expect(menu.getByRole("menuitem", { name: "Open" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Download" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Rename" })).toHaveCount(0);
      await expect(menu.getByRole("menuitem", { name: "Move / Copy" })).toHaveCount(0);
      await expect(menu.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
      await expect(menu.getByRole("menuitem", { name: "Share" })).toHaveCount(0);
      await expect(menu.getByRole("menuitem", { name: "Check out" })).toHaveCount(0);
      await expect(menu.getByRole("menuitem", { name: "Check in" })).toHaveCount(0);
    } finally {
      await viewerContext.close();
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
