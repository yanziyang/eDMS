import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import {
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

async function scanAndExpectClean(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
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

test.describe.serial("WCAG 2.1 AA axe scans", () => {
  let session: AdminSession;
  let siteSlug: string;
  let siteName: string;
  let libraryId: string;
  let fileName: string;
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
    await apiUpload(request, session.token, libraryId, fileName, "a11y");
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

  test("home", async () => {
    await session.page.goto("/");
    await expect(session.page.getByRole("heading", { name: "My Sites" })).toBeVisible();
    await scanAndExpectClean(session.page, "home");
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
    await scanAndExpectClean(session.page, "admin users");
  });

  test("admin settings", async () => {
    await session.page.goto("/admin/settings");
    await expect(session.page.locator("#max-upload-mb")).toHaveValue(/\d+/);
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
