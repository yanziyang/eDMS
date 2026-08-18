import { expect, test } from "@playwright/test";
import {
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  loginUi,
} from "./helpers";

test("a touch long-press opens the document context menu", async ({ browser, playwright }) => {
  const session = await getAdminSession(browser);
  const request = await adminRequest(playwright, session.token);
  const site = await apiCreateSite(request, session.token, "Touch Context Menu");
  const libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
  const documentName = `touch-context-${Date.now()}.txt`;
  await apiUpload(request, session.token, libraryId, documentName, "touch context menu");

  const touchContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touchContext.newPage();

  try {
    await loginUi(touchPage);
    await touchPage.goto(`/sites/${site.slug}/libraries/${libraryId}`);
    const row = touchPage.getByRole("row", { name: new RegExp(documentName) });
    await expect(row).toBeVisible();

    const bounds = await row.boundingBox();
    expect(bounds).not.toBeNull();
    const cdp = await touchContext.newCDPSession(touchPage);
    const x = (bounds?.x ?? 0) + Math.min((bounds?.width ?? 2) / 2, 180);
    const y = (bounds?.y ?? 0) + Math.min((bounds?.height ?? 2) / 2, 24);

    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, radiusX: 8, radiusY: 8, id: 1 }],
    });
    await touchPage.waitForTimeout(800);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect(touchPage.getByRole("menuitem", { name: "Open" })).toBeVisible();
    await expect(touchPage.getByRole("menuitem", { name: "Download" })).toBeVisible();
  } finally {
    await touchContext.close();
    await request.dispose();
  }
});
