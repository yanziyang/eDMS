import { test, expect, type Page } from "@playwright/test";
import {
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
  let fileName: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    const site = await apiCreateSite(request, session.token, "E2E Responsive");
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    fileName = `responsive-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, fileName, "responsive");
    await request.dispose();
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}): home → site home → library → sheet`, async () => {
      await session.page.setViewportSize({ width: viewport.width, height: viewport.height });

      await session.page.goto("/");
      await expect(session.page.getByRole("heading", { name: "My Sites" })).toBeVisible();
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

      await session.page.goto(`/sites/${siteSlug}`);
      await expect(session.page.getByRole("heading", { name: "E2E Responsive" })).toBeVisible();
      await expectNoHorizontalScroll(session.page, `${viewport.name} site home`);

      await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
      await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
      await expect(
        session.page.getByRole("button", { name: "Upload", exact: true }),
      ).toBeVisible();
      await expectNoHorizontalScroll(session.page, `${viewport.name} library`);

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
          "div.overflow-x-auto.rounded-lg.border",
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
