import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import {
  API_BASE,
  adminRequest,
  apiCreateSite,
  apiCreateUser,
  apiGetDefaultLibrary,
  apiUpload,
  getAdminSession,
  type AdminSession,
} from "./helpers";

// Violations that cannot be fixed at the page level without editing a shared
// ui/ primitive are listed here by rule id, with the reason. Do not add to
// this map to silence failures — every entry must point at a ui/ file.
const JUSTIFIED_VIOLATIONS: Record<string, string> = {};

interface Violation {
  id: string;
  help: string;
  nodes: { target: string[]; html: string }[];
}

function unapproved(violations: Violation[]): Violation[] {
  return violations.filter((violation) => !(violation.id in JUSTIFIED_VIOLATIONS));
}

async function scanAndExpectClean(page: Page, label: string, include?: string): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const violations = unapproved(results.violations);
  if (violations.length > 0) {
    console.log(`[axe] ${label} — ${violations.length} unapproved violation(s)`);
    for (const violation of violations) {
      console.log(`- ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes) {
        console.log(`    target: ${node.target.join(" ")}`);
        console.log(`    html: ${node.html.slice(0, 200)}`);
      }
    }
  }
  expect(violations, `axe violations on "${label}"`).toEqual([]);
}

async function waitForToastToClear(page: Page, message: string): Promise<void> {
  const toast = page.getByText(message, { exact: true });
  await expect(toast).toBeVisible();
  await expect(toast).toBeHidden({ timeout: 10_000 });
}

test.describe.serial("WCAG 2.1 AA axe scans", () => {
  let session: AdminSession;
  let siteSlug: string;
  let siteName: string;
  let libraryId: string;
  let fileName: string;
  let secondFileName: string;
  let deletedFileName: string;
  let userEmail: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    const request = await adminRequest(playwright, session.token);
    siteName = `E2E A11y ${Date.now()}`;
    const site = await apiCreateSite(request, session.token, siteName);
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);
    fileName = `a11y-doc-${Date.now()}.txt`;
    const documentId = await apiUpload(request, session.token, libraryId, fileName, "a11y");
    secondFileName = `a11y-bulk-${Date.now()}.txt`;
    await apiUpload(request, session.token, libraryId, secondFileName, "a11y bulk");
    const favorite = await request.post(`${API_BASE}/Document/objects/${documentId}/favorite`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(favorite.status()).toBe(204);
    deletedFileName = `a11y-deleted-${Date.now()}.txt`;
    const deletedId = await apiUpload(request, session.token, libraryId, deletedFileName, "gone");
    await request.delete(`http://localhost:5190/api/v1/documents/${deletedId}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    userEmail = `a11y-user-${Date.now()}@e2e.local`;
    await apiCreateUser(request, session.token, userEmail);
    await request.dispose();
  });

  test("login page", async () => {
    await session.page.goto("/login");
    await expect(session.page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await scanAndExpectClean(session.page, "login");
  });

  test("login page with configured SSO providers", async () => {
    await session.page.route("**/api/v1/auth/sso/providers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ oidc: true, saml: true }),
      }));
    try {
      await session.page.goto("/login");
      await expect(
        session.page.getByRole("button", { name: "Sign in with SSO" }),
      ).toBeVisible();
      await expect(
        session.page.getByRole("button", { name: "Sign in with SAML SSO" }),
      ).toBeVisible();
      await scanAndExpectClean(session.page, "login with SSO providers");
    } finally {
      await session.page.unroute("**/api/v1/auth/sso/providers");
    }
  });

  test("SSO completion loading and error states", async () => {
    await session.page.route("**/api/v1/auth/sso/exchange", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.fulfill({
        status: 401,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "Unauthorized", status: 401 }),
      });
    });
    try {
      await session.page.goto("/sso/complete?code=opaque-e2e-code");
      await expect(
        session.page.getByRole("heading", { name: "Completing sign-in…" }),
      ).toBeVisible();
      await scanAndExpectClean(session.page, "SSO completion loading");
      await expect(
        session.page.getByRole("heading", { name: "Sign-in could not be completed" }),
      ).toBeVisible();
      await scanAndExpectClean(session.page, "SSO completion exchange error");
    } finally {
      await session.page.unroute("**/api/v1/auth/sso/exchange");
    }

    await session.page.goto("/sso/complete?error=provider-error");
    await expect(
      session.page.getByRole("heading", { name: "Sign-in could not be completed" }),
    ).toBeVisible();
    await scanAndExpectClean(session.page, "SSO completion provider error");

    await session.page.goto("/sso/complete");
    await expect(session.page.getByText(/missing or has expired/i)).toBeVisible();
    await scanAndExpectClean(session.page, "SSO completion missing code");
  });

  test("home", async () => {
    await session.page.goto("/");
    await expect(session.page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(
      session.page.getByRole("heading", { name: "Recent", exact: true }),
    ).toBeVisible();
    await expect(
      session.page.getByRole("link", { name: new RegExp(`^${fileName} `) }),
    ).toBeVisible();
    await scanAndExpectClean(session.page, "home");
  });

  test("favorites list and toggle", async () => {
    await session.page.goto("/favorites");
    await expect(session.page.getByRole("heading", { name: "Favorites" })).toBeVisible();
    await expect(session.page.getByText(fileName, { exact: true })).toBeVisible();
    await scanAndExpectClean(session.page, "favorites list");

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: fileName, exact: true })
      .click();
    await expect(
      session.page.getByRole("button", { name: `Remove from favorites` }),
    ).toBeVisible();
    await scanAndExpectClean(session.page, "favorites toggle in document properties");
  });

  test("site home", async () => {
    await session.page.goto(`/sites/${siteSlug}`);
    await expect(session.page.getByRole("heading", { name: siteName })).toBeVisible();
    await scanAndExpectClean(session.page, "site home");
  });

  test("library with items", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
    await scanAndExpectClean(session.page, "library");
  });

  test("library view picker and site/library follow controls", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await scanAndExpectClean(session.page, "saved view picker");
    await session.page.getByRole("combobox", { name: "Saved view" }).click();
    await expect(session.page.getByRole("option", { name: "Save current as…" })).toBeVisible();
    await session.page.keyboard.press("Escape");

    await expect(session.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    await session.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();
    await waitForToastToClear(session.page, "Following library");
    await scanAndExpectClean(session.page, "library follow toggle");
    await session.page.getByRole("button", { name: "Unfollow", exact: true }).click();

    await session.page.goto(`/sites/${siteSlug}`);
    await expect(session.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
    await session.page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(session.page.getByRole("button", { name: "Unfollow", exact: true })).toBeVisible();
    await waitForToastToClear(session.page, "Following site");
    await scanAndExpectClean(session.page, "site follow toggle");
    await session.page.getByRole("button", { name: "Unfollow", exact: true }).click();
  });

  test("document details sheet open", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: fileName, exact: true })
      .click();
    await expect(session.page.getByRole("heading", { name: fileName, exact: true })).toBeVisible();
    await expect(
      session.page.locator('[data-slot="sheet-content"][data-state="open"]'),
    ).toBeVisible();
    await scanAndExpectClean(session.page, "document details sheet");
  });

  test("share dialog open", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page
      .locator("tr", { hasText: fileName })
      .getByRole("button", { name: fileName, exact: true })
      .click();
    await session.page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = session.page.locator('[data-slot="dialog-content"][data-state="open"]');
    await expect(dialog.getByRole("heading", { name: new RegExp("Share") })).toBeVisible();
    await scanAndExpectClean(session.page, "share dialog");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  });

  test("bulk edit dialog and keyboard context menu", async () => {
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page.getByRole("checkbox", { name: `Select ${fileName}` }).click();
    await session.page.getByRole("checkbox", { name: `Select ${secondFileName}` }).click();
    await session.page.getByRole("button", { name: "Edit properties", exact: true }).click();
    await expect(session.page.getByRole("dialog")).toBeVisible();
    await scanAndExpectClean(session.page, "bulk edit dialog");
    await session.page.getByRole("button", { name: "Cancel", exact: true }).click();

    const row = session.page.locator("tr", { hasText: fileName });
    await row.focus();
    await row.press("Shift+F10");
    const menu = session.page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Open" })).toBeVisible();
    await scanAndExpectClean(session.page, "keyboard-opened context menu", '[data-slot="context-menu-content"]');
    await session.page.keyboard.press("Escape");
  });

  test("search", async () => {
    await session.page.goto("/search");
    await expect(session.page.getByRole("heading", { name: "Search" })).toBeVisible();
    await scanAndExpectClean(session.page, "search");
  });

  test("profile", async () => {
    await session.page.goto("/me/profile");
    await expect(session.page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await scanAndExpectClean(session.page, "profile");
  });

  test("recycle bin", async () => {
    await session.page.goto(`/recycle-bin/${siteSlug}`);
    await expect(session.page.getByRole("heading", { name: "Recycle Bin" })).toBeVisible();
    await expect(session.page.locator("tr", { hasText: deletedFileName })).toBeVisible();
    await scanAndExpectClean(session.page, "recycle bin");
  });

  test("admin users", async () => {
    await session.page.goto("/admin/users");
    await expect(session.page.getByRole("heading", { name: "Admin Center" })).toBeVisible();
    await expect(session.page.locator("tbody tr").first()).toBeVisible();
    await expect(
      session.page.getByRole("switch", { name: /Disable local login for/ }).first(),
    ).toBeVisible();
    await expect(
      session.page.getByRole("switch", { name: /Allow local login exemption for/ }).first(),
    ).toBeVisible();
    await scanAndExpectClean(session.page, "admin users");
  });

  test("admin settings", async () => {
    await session.page.goto("/admin/settings");
    await expect(session.page.locator("#max-upload-mb")).toHaveValue(/\d+/);
    await expect(
      session.page.getByRole("switch", { name: "Require SSO for all local logins" }),
    ).toBeVisible();
    await expect(session.page.getByText("SSO providers")).toBeVisible();
    await scanAndExpectClean(session.page, "admin settings");
  });

  test("admin audit log", async () => {
    await session.page.goto("/admin/audit-log");
    await session.page.locator("#audit-site").click();
    await session.page.getByRole("option", { name: siteName }).click();
    await expect(session.page.locator("tbody tr").first()).toBeVisible();
    await scanAndExpectClean(session.page, "admin audit log");
  });

  test("admin storage", async () => {
    await session.page.goto("/admin/storage");
    await expect(session.page.getByText("Total storage used")).toBeVisible();
    await scanAndExpectClean(session.page, "admin storage");
  });
});
