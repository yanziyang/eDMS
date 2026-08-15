import { test, expect } from "@playwright/test";
import {
  apiCheckin,
  apiCheckout,
  apiCreateSite,
  apiGetDefaultLibrary,
  apiLogin,
  apiUpload,
  loginUi,
} from "./helpers";

test("checked-out state is reflected in the library UI", async ({ page, playwright }) => {
  const request = await playwright.request.newContext();
  const token = await apiLogin(request);
  const site = await apiCreateSite(request, token, "E2E Versioning");
  const libraryId = await apiGetDefaultLibrary(request, token, site.id);
  const fileName = `checkout-${Date.now()}.txt`;
  const documentId = await apiUpload(request, token, libraryId, fileName, "v1");

  await apiCheckout(request, token, documentId);

  await loginUi(page);
  await page.goto(`/sites/${site.slug}/libraries/${libraryId}`);
  await expect(
    page.locator("tr", { hasText: fileName }).getByText("Checked out"),
  ).toBeVisible();

  await apiCheckin(request, token, documentId);
  await page.reload();
  await expect(
    page.locator("tr", { hasText: fileName }).getByText("Checked out"),
  ).toHaveCount(0);

  await request.dispose();
});
