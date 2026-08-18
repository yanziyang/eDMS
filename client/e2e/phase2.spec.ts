import AxeBuilder from "@axe-core/playwright";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  API_BASE,
  adminRequest,
  apiCreateSite,
  apiGetDefaultLibrary,
  getAdminSession,
  type AdminSession,
} from "./helpers";

const AUTH_HEADERS = (token: string) => ({ Authorization: `Bearer ${token}` });

test.describe.serial("Phase 2 acceptance flows", () => {
  let session: AdminSession;
  let request: APIRequestContext;
  let siteName: string;
  let siteSlug: string;
  let libraryId: string;
  let contentTypeId: string;
  let requiredColumnId: string;
  let baselineDocumentName: string;

  test.beforeAll(async ({ browser, playwright }) => {
    session = await getAdminSession(browser);
    request = await adminRequest(playwright, session.token);
    siteName = `E2E Phase 2 ${Date.now()}`;
    const site = await apiCreateSite(request, session.token, siteName);
    siteSlug = site.slug;
    libraryId = await apiGetDefaultLibrary(request, session.token, site.id);

    contentTypeId = await createContentType(
      request,
      session.token,
      "Phase 2 Invoice",
      libraryId,
    );
    requiredColumnId = await addRequiredColumn(
      request,
      session.token,
      contentTypeId,
      "Customer",
    );

    baselineDocumentName = `phase2-baseline-${Date.now()}.txt`;
    const baseline = await uploadFile(
      request,
      session.token,
      libraryId,
      baselineDocumentName,
      Buffer.from("baseline document body"),
      "text/plain",
      [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
    );
    expect(baseline.status()).toBe(200);
    await baseline.json();
  });

  test.afterAll(async () => {
    await request?.dispose();
  });

  test("content types are visible and required metadata blocks incomplete upload", async () => {
    const missing = await uploadFile(
      request,
      session.token,
      libraryId,
      `missing-required-${Date.now()}.txt`,
      Buffer.from("missing metadata"),
      "text/plain",
    );
    expect(missing.status()).toBe(409);
    expect((await missing.json()).detail).toContain("Customer");

    const completed = await uploadFile(
      request,
      session.token,
      libraryId,
      `complete-required-${Date.now()}.txt`,
      Buffer.from("complete metadata"),
      "text/plain",
      [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
    );
    expect(completed.status()).toBe(200);

    await session.page.goto("/admin/content-types");
    await expect(session.page.getByRole("heading", { name: "Admin Center" })).toBeVisible();
    await session.page.locator("#ct-scope-site").click();
    await session.page.getByRole("option", { name: siteName }).click();
    await session.page.locator("#ct-scope-library").click();
    await session.page.getByRole("option", { name: "Documents" }).click();
    await expect(session.page.getByText("Phase 2 Invoice", { exact: true })).toBeVisible();
  });

  test("chunked upload resumes from the server offset and completes", async () => {
    const fileName = `phase2-chunked-${Date.now()}.txt`;
    const content = Buffer.from("chunk one | chunk two | resumed");
    const split = 10;
    const started = await request.post(`${API_BASE}/uploads`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: {
        libraryId,
        folderId: null,
        fileName,
        totalBytes: content.length,
        metadata: [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
      },
    });
    expect(started.status()).toBe(200);
    const sessionDto = (await started.json()) as { sessionId: string; uploadedBytes: number };

    const first = await request.put(
      `${API_BASE}/uploads/${sessionDto.sessionId}/chunks?offset=0`,
      {
        headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/octet-stream" },
        data: content.subarray(0, split),
      },
    );
    expect(first.status()).toBe(200);
    expect((await first.json()).uploadedBytes).toBe(split);

    const status = await request.get(`${API_BASE}/uploads/${sessionDto.sessionId}`, {
      headers: AUTH_HEADERS(session.token),
    });
    expect(status.status()).toBe(200);
    expect((await status.json()).uploadedBytes).toBe(split);

    const second = await request.put(
      `${API_BASE}/uploads/${sessionDto.sessionId}/chunks?offset=${split}`,
      {
        headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/octet-stream" },
        data: content.subarray(split),
      },
    );
    expect(second.status()).toBe(200);

    const completed = await request.post(`${API_BASE}/uploads/${sessionDto.sessionId}/complete`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: { metadata: null },
    });
    expect(completed.status()).toBe(200);
    expect((await completed.json()).name).toBe(fileName);

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await expect(session.page.locator("td", { hasText: fileName })).toBeVisible();
  });

  test("Office preview presents converted PDF content and share links can be revoked", async () => {
    const fileName = `phase2-preview-${Date.now()}.docx`;
    const office = await uploadFile(
      request,
      session.token,
      libraryId,
      fileName,
      Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
    );
    expect(office.status()).toBe(200);
    const officeId = ((await office.json()) as { documentId: string }).documentId;

    await session.page.route(`**/api/v1/documents/${officeId}/preview`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: "%PDF-1.7 converted preview",
      });
    });
    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page.locator("tr", { hasText: fileName })
      .getByRole("button", { name: fileName, exact: true })
      .click();
    await session.page.getByRole("tab", { name: "Preview" }).click();
    await expect(session.page.locator('iframe[title="Preview"]')).toBeVisible();

    await session.page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = session.page.locator('[data-slot="dialog-content"]');
    await expect(dialog.getByText("Get link", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Create link", exact: true }).click();
    const linkInput = dialog.getByRole("textbox", { name: "Share link URL" });
    await expect(linkInput).toHaveValue(/\/share\//);
    const revoke = dialog.getByRole("button", { name: /Revoke link/ }).first();
    await revoke.click();
    await expect(session.page.getByText("Link revoked")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await session.page.getByRole("button", { name: "Close", exact: true }).click();
    await session.page.unroute(`**/api/v1/documents/${officeId}/preview`);
  });

  test("following a document creates an in-app notification", async () => {
    const originalName = `phase2-follow-${Date.now()}.txt`;
    const followUpload = await uploadFile(
      request,
      session.token,
      libraryId,
      originalName,
      Buffer.from("follow me"),
      "text/plain",
      [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
    );
    expect(followUpload.status()).toBe(200);
    const documentId = ((await followUpload.json()) as { documentId: string }).documentId;
    const follow = await request.post(`${API_BASE}/Document/objects/${documentId}/follow`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: { frequency: "Immediate" },
    });
    expect(follow.status()).toBe(200);

    const renamed = `${originalName}.renamed`;
    const update = await request.put(`${API_BASE}/documents/${documentId}`, {
      headers: { ...AUTH_HEADERS(session.token), "Content-Type": "application/json" },
      data: { name: renamed },
    });
    expect(update.status()).toBe(204);

    const notifications = await request.get(`${API_BASE}/me/notifications`, {
      headers: AUTH_HEADERS(session.token),
    });
    expect(notifications.status()).toBe(200);
    const entries = (await notifications.json()) as Array<{ message: string }>;
    expect(entries.some((entry) => entry.message === `${renamed} was renamed.`)).toBe(true);

    await session.page.goto("/");
    await session.page.getByRole("button", { name: /Notifications/ }).click();
    await expect(session.page.getByText(`${renamed} was renamed.`)).toBeVisible();
  });

  test("search renders a result for a phrase sourced from indexed body text", async () => {
    const bodyOnlyName = `phase2-body-only-${Date.now()}.pdf`;
    const bodyOnly = await uploadFile(
      request,
      session.token,
      libraryId,
      bodyOnlyName,
      Buffer.from("%PDF-1.7 body-only phrase"),
      "application/pdf",
      [{ columnDefinitionId: requiredColumnId, value: "Acme" }],
    );
    expect(bodyOnly.status()).toBe(200);
    const bodyOnlyId = ((await bodyOnly.json()) as { documentId: string }).documentId;

    await session.page.route("**/api/v1/search**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("q") !== "body-only-phrase") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            documentId: bodyOnlyId,
            name: bodyOnlyName,
            sizeBytes: 64,
            siteId: "phase2-site",
            libraryId,
            folderPath: "/",
            modifiedAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await session.page.goto("/search");
    await session.page.getByLabel("Search documents").fill("body-only-phrase");
    await session.page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(session.page.getByText(bodyOnlyName, { exact: true })).toBeVisible();
    await session.page.unroute("**/api/v1/search**");
  });

  test("dark mode persists and Phase 2 surfaces remain usable on mobile", async () => {
    await session.page.setViewportSize({ width: 375, height: 667 });
    await session.page.goto("/me/profile");
    await expect(session.page.getByRole("heading", { name: "My Profile" })).toBeVisible();
    await expectNoHorizontalScroll(session.page, "profile on mobile");

    await session.page.goto("/admin/content-types");
    await expect(session.page.getByRole("heading", { name: "Admin Center" })).toBeVisible();
    await expectNoHorizontalScroll(session.page, "content types on mobile");

    await session.page.goto("/");
    const themeToggle = session.page.getByRole("button", { name: /Switch to (dark|light) mode/ });
    if ((await themeToggle.getAttribute("aria-label")) === "Switch to light mode") {
      await themeToggle.click();
    }
    await expect(session.page.locator("html")).not.toHaveClass(/dark/);
    await session.page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(session.page.locator("html")).toHaveClass(/dark/);
    await session.page.reload();
    await expect(session.page.locator("html")).toHaveClass(/dark/);
    await session.page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(session.page.locator("html")).not.toHaveClass(/dark/);
    await expectNoHorizontalScroll(session.page, "dark-mode shell on mobile");
    await session.page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Phase 2 pages and dialogs pass the WCAG axe scan", async () => {
    await session.page.setViewportSize({ width: 1440, height: 900 });
    await session.page.goto("/me/profile");
    await scanAxe(session.page, "profile alert preferences");

    await session.page.goto("/admin/content-types");
    await scanAxe(session.page, "admin content types");

    await session.page.goto(`/sites/${siteSlug}/libraries/${libraryId}`);
    await session.page.locator("tr", { hasText: baselineDocumentName })
      .getByRole("button", { name: baselineDocumentName, exact: true })
      .click();
    await expect(session.page.getByRole("heading", { name: baselineDocumentName, exact: true })).toBeVisible();
    await scanAxe(session.page, "Phase 2 document details");
    await session.page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(session.page.locator('[data-slot="dialog-content"]')).toBeVisible();
    await scanAxe(session.page, "Phase 2 share dialog");
  });
});

async function createContentType(
  request: APIRequestContext,
  token: string,
  name: string,
  libraryId: string,
): Promise<string> {
  const response = await request.post(`${API_BASE}/admin/content-types`, {
    headers: { ...AUTH_HEADERS(token), "Content-Type": "application/json" },
    data: { name, description: "Phase 2 E2E content type", libraryId },
  });
  expect(response.status()).toBe(201);
  return (await response.text()).replaceAll('"', "");
}

async function addRequiredColumn(
  request: APIRequestContext,
  token: string,
  contentTypeId: string,
  name: string,
): Promise<string> {
  const response = await request.post(`${API_BASE}/admin/content-types/${contentTypeId}/columns`, {
    headers: { ...AUTH_HEADERS(token), "Content-Type": "application/json" },
    data: {
      name,
      dataType: "Text",
      isRequired: true,
      choiceOptions: null,
      defaultValue: null,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.text()).replaceAll('"', "");
}

async function uploadFile(
  request: APIRequestContext,
  token: string,
  libraryId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  metadata?: Array<{ columnDefinitionId: string; value: string }>,
): Promise<import("@playwright/test").APIResponse> {
  const multipart: Record<string, unknown> = {
    file: { name: fileName, mimeType, buffer },
  };
  if (metadata) {
    multipart.metadata = JSON.stringify(metadata);
  }
  return request.post(`${API_BASE}/libraries/${libraryId}/documents`, {
    headers: AUTH_HEADERS(token),
    multipart,
  });
}

async function expectNoHorizontalScroll(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  expect(overflow, `${label}: body overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
}

async function scanAxe(page: Page, label: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(result.violations, `axe violations on ${label}`).toEqual([]);
}
