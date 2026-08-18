import { test, expect, type Page } from "@playwright/test";
import {
  API_BASE,
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: body overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
}

async function waitForToastToClear(page: Page, message: string): Promise<void> {
  const toast = page.getByText(message, { exact: true });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 10_000 });
}

async function expectWithinViewport(
  page: Page,
  selector: string,
  label: string,
  width: number,
): Promise<void> {
  // Sheet/dialog enter animations (slide/zoom) run ~100–200ms; measure only
  // once the box stops changing so the assertion is stable.
  let previous = { x: Number.NaN, width: Number.NaN };
  await expect
    .poll(async () => {
      const box = await page.locator(selector).boundingBox();
      if (!box) return false;
      const stable =
        Math.abs(box.x - previous.x) < 0.5 && Math.abs(box.width - previous.width) < 0.5;
      previous = box;
      return stable;
    }, { timeout: 5000 })
    .toBe(true);
  const box = await page.locator(selector).boundingBox();
  expect(box, `${label} has no bounding box`).not.toBeNull();
  if (box) {
    expect(box.x, `${label} starts off-screen`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${label} extends past the viewport`).toBeLessThanOrEqual(width + 1);
  }
}

test.describe.serial("responsive key flow", () => {
  let session: AdminSession;
  let siteSlug: string;
  let libraryId: string;
  let folderId: string;
  let folderName: string;
  let childFolderName: string;
  let fileName: string;
  let secondFileName: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Responsive");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    folderName = `Responsive folder ${Date.now()}`;
    const folderResponse = await request.post(`${API_BASE}/libraries/${libraryId}/folders`, {
      headers: { Authorization: `Bearer ${session.token}` },
      data: { name: folderName },
    });
    expect(folderResponse.status()).toBe(201);
    folderId = (await folderResponse.text()).replaceAll('"', "");
    childFolderName = `Responsive child ${Date.now()}`;
    const childFolderResponse = await request.post(`${API_BASE}/folders/${folderId}/folders`, {
      headers: { Authorization: `Bearer ${session.token}` },
      data: { name: childFolderName },
    });
    expect(childFolderResponse.status()).toBe(201);
    fileName = `responsive-${Date.now()}.txt`;
    const documentId = await apiUpload(request, session.token, libraryId, fileName, "responsive");
    secondFileName = `responsive-second-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, secondFileName, "responsive second");
    const favorite = await request.post(`${API_BASE}/Document/objects/${documentId}/favorite`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(favorite.status()).toBe(204);
    await request.dispose();
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}): home → site home → library → sheet`, async () => {
      await session.page.setViewportSize({ width: viewport.width, height: viewport.height });

      await session.page.goto("/");
      await expect(session.page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await expectNoHorizontalScroll(session.page, `${viewport.name} home`);

      if (viewport.width < 768) {
        const recycleLinks = session.page.getByRole("link", { name: "Recycle Bin" });
        await expect(recycleLinks).toHaveCount(0);
        await expect(
          session.page.getByRole("button", { name: "Open navigation menu" }),
        ).toBeVisible();
        await session.page.getByRole("button", { name: "Open navigation menu" }).click();
        await expect(recycleLinks).toHaveCount(1);
        await session.page
          .locator("div.fixed.inset-0.z-50")
          .locator("div.absolute.inset-0")
          .click({ position: { x: viewport.width - 24, y: 120 } });
        await expect(recycleLinks).toHaveCount(0);
      } else {
        await expect(
          session.page.getByRole("button", { name: "Open navigation menu" }),
        ).toHaveCount(0);
      }

      if (viewport.width >= 1024) {
        await session.page.getByRole("button", { name: "Collapse navigation" }).click();
        await expect(
          session.page.getByRole("button", { name: "Expand navigation" }),
        ).toBeVisible();
        await expectNoHorizontalScroll(session.page, `${viewport.name} collapsed navigation`);
        await session.page.getByRole("button", { name: "Expand navigation" }).click();
      }

      await session.page.goto(`/sites/${siteSlug}`);
      await expect(session.page.getByRole("heading", { name: "E2E Responsive" })).toBeVisible();
      await expectNoHorizontalScroll(session.page, `${viewport.name} site home`);

      await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
      await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
      await expect(
        session.page.getByRole("button", { name: "Upload", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalScroll(session.page, `${viewport.name} library`);

      if (viewport.width >= 1024) {
        const tree = session.page.getByRole("tree", { name: "Library folders" });
        await expect(tree).toBeVisible();
        const rootFolder = tree.getByRole("button", { name: `Open folder ${folderName}` });
        await expect(rootFolder).toBeVisible();
        await rootFolder.focus();
        await session.page.keyboard.press("ArrowRight");
        await expect(
          tree.getByRole("button", { name: `Open folder ${childFolderName}` }),
        ).toBeVisible();
        await rootFolder.click();
        await expect(session.page).toHaveURL(new RegExp(`[?&]folderId=${folderId}`));
        await expectNoHorizontalScroll(session.page, `${viewport.name} folder tree`);
      } else {
        await session.page.getByRole("button", { name: "Folders", exact: true }).click();
        const folderSheet = session.page.getByRole("dialog", { name: "Folders" });
        await expect(folderSheet).toBeVisible();
        await expect(
          folderSheet.getByRole("tree", { name: "Library folders" }),
        ).toBeVisible();
        await folderSheet
          .getByRole("button", { name: `Open folder ${folderName}` })
          .click();
        await expect(session.page).toHaveURL(new RegExp(`[?&]folderId=${folderId}`));
        await expectNoHorizontalScroll(session.page, `${viewport.name} mobile folder sheet`);
      }

      await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);

      await session.page
        .locator("tr", { hasText: fileName })
        .getByRole("button", { name: fileName, exact: true })
        .click();
      await expect(
        session.page.getByRole("heading", { name: fileName, exact: true }),
      ).toBeVisible();
      await expect(session.page.locator('[data-slot="sheet-content"]')).toBeVisible();
      await expectWithinViewport(
        session.page,
        '[data-slot="sheet-content"]',
        `${viewport.name} sheet`,
        viewport.width,
      );
      await expectNoHorizontalScroll(session.page, `${viewport.name} sheet open`);

      await session.page.getByRole("button", { name: "Share", exact: true }).click();
      const shareDialog = session.page.locator('[data-slot="dialog-content"]');
      await expect(shareDialog).toBeVisible();
      await expectWithinViewport(
        session.page,
        '[data-slot="dialog-content"]',
        `${viewport.name} share dialog`,
        viewport.width,
      );
      await shareDialog.getByRole("button", { name: "Cancel", exact: true }).click();

      await session.page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(
        session.page.getByRole("button", { name: "Close", exact: true }),
      ).toHaveCount(0);
      await expectNoHorizontalScroll(session.page, `${viewport.name} sheet closed`);
    });
  }

  test("mobile (375x667): Phase 4 surfaces remain usable without horizontal overflow", async () => {
    const width = 375;
    await session.page.setViewportSize({ width, height: 667 });

    await session.page.goto("/");
    await expect(
      session.page.getByRole("heading", { name: "Recent", exact: true }),
    ).toBeVisible();
    await expect(
      session.page.getByRole("link", { name: new RegExp(`^${fileName} `) }),
    ).toBeVisible();
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 home Recent");

    await session.page.goto("/favorites");
    await expect(session.page.getByRole("heading", { name: "Favorites" })).toBeVisible();
    await expect(session.page.getByText(fileName, { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 favorites");

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.getByRole("combobox", { name: "Saved view" })).toBeVisible();
    await session.page.getByRole("combobox", { name: "Saved view" }).click();
    await expect(session.page.getByRole("option", { name: "Save current as…" })).toBeVisible();
    await session.page.keyboard.press("Escape");
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 view picker");

    const followLibrary = session.page.getByRole("button", { name: "Follow", exact: true });
    await expect(followLibrary).toBeVisible();
    await followLibrary.click();
    await expect(session.page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();
    await waitForToastToClear(session.page, "Following library");
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 library follow");
    await session.page.getByRole("button", { name: "Unfollow", exact: true }).click();

    await session.page.getByRole("checkbox", { name: `Select ${fileName}` }).click();
    await session.page.getByRole("checkbox", { name: `Select ${secondFileName}` }).click();
    await session.page.getByRole("button", { name: "Edit properties", exact: true }).click();
    const bulkDialog = session.page.getByRole("dialog");
    await expect(bulkDialog).toBeVisible();
    await expectWithinViewport(session.page, '[data-slot="dialog-content"]', "mobile Phase 4 bulk edit", width);
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 bulk edit");
    await bulkDialog.getByRole("button", { name: "Cancel", exact: true }).click();

    const row = session.page.locator("tr", { hasText: fileName });
    await row.focus();
    await row.press("Shift+F10");
    await expect(session.page.getByRole("menuitem", { name: "Open" })).toBeVisible();
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 context menu");
    await session.page.keyboard.press("Escape");

    await session.page.goto(`/sites/${siteSlug}`);
    await expect(session.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    await session.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();
    await waitForToastToClear(session.page, "Following site");
    await expectNoHorizontalScroll(session.page, "mobile Phase 4 site follow");
    await session.page.getByRole("button", { name: "Unfollow", exact: true }).click();
  });
});

test.describe.serial("responsive SSO surfaces", () => {
  let session: AdminSession;

  test.beforeAll(async ({ browser }) => {
    session = await getAdminSession(browser);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}): login and admin SSO surfaces`, async () => {
      await session.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await session.page.route("**/api/v1/auth/sso/providers", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ oidc: true, saml: true }),
        }));
      try {
        await session.page.goto("/login");
        await expect(session.page.getByRole("button", { name: "Sign in with SSO" })).toBeVisible();
        await expect(session.page.getByRole("button", { name: "Sign in with SAML SSO" })).toBeVisible();
        await expectWithinViewport(session.page, "form", `${viewport.name} login form`, viewport.width);
        await expectNoHorizontalScroll(session.page, `${viewport.name} login`);

        await session.page.goto("/sso/complete?error=provider-error");
        await expect(
          session.page.getByRole("heading", { name: "Sign-in could not be completed" }),
        ).toBeVisible();
        await expectWithinViewport(
          session.page,
          'a[href="/login"]',
          `${viewport.name} SSO completion error`,
          viewport.width,
        );
        await expectNoHorizontalScroll(session.page, `${viewport.name} SSO completion`);

        await session.page.goto("/admin/settings");
        await expect(session.page.getByRole("switch", { name: "Require SSO for all local logins" })).toBeVisible();
        await expectWithinViewport(session.page, "#require-sso", `${viewport.name} SSO switch`, viewport.width);
        await expectNoHorizontalScroll(session.page, `${viewport.name} admin settings`);

        await session.page.goto("/admin/users");
        await expect(session.page.getByRole("switch", { name: /Disable local login for/ }).first()).toBeVisible();
        await expectWithinViewport(
          session.page,
          "div.overflow-x-auto.rounded-xl.border.bg-card",
          `${viewport.name} admin users table`,
          viewport.width,
        );
        await expectNoHorizontalScroll(session.page, `${viewport.name} admin users`);
      } finally {
        await session.page.unroute("**/api/v1/auth/sso/providers");
      }
    });
  }
});
