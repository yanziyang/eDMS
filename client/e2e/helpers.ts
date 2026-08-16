import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  Page,
  PlaywrightTestArgs,
} from "@playwright/test";
import { expect } from "@playwright/test";

export const API_BASE = "http://localhost:5190/api/v1";
export const ADMIN = { email: "admin@e2e.local", password: "E2eAdmin123!" };

export async function apiLogin(
  request: APIRequestContext,
  email: string = ADMIN.email,
  password: string = ADMIN.password,
): Promise<string> {
  const response = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`login failed: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

export async function apiCreateSite(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<{ id: string; slug: string }> {
  const slug = `${slugify(name)}-${Date.now()}`;
  const response = await request.post(`${API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, urlSlug: slug },
  });
  if (response.status() !== 201) {
    throw new Error(`create site failed: ${response.status()} ${await response.text()}`);
  }
  const id = (await response.text()).replaceAll('"', "");
  return { id, slug };
}

export async function apiGetDefaultLibrary(
  request: APIRequestContext,
  token: string,
  siteId: string,
): Promise<string> {
  const response = await request.get(`${API_BASE}/sites/${siteId}/libraries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const libraries = (await response.json()) as Array<{ id: string }>;
  return libraries[0].id;
}

export async function apiCreateLibrary(
  request: APIRequestContext,
  token: string,
  siteId: string,
  name: string,
): Promise<string> {
  const response = await request.post(`${API_BASE}/sites/${siteId}/libraries`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, description: null, enableVersioning: true, enableMinorVersions: false, requireCheckout: false },
  });
  if (response.status() !== 201) {
    throw new Error(`create library failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.text()).replaceAll('"', "");
}

export async function apiUpload(
  request: APIRequestContext,
  token: string,
  libraryId: string,
  name: string,
  content = "e2e content",
): Promise<string> {
  const response = await request.post(`${API_BASE}/libraries/${libraryId}/documents`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name, mimeType: "text/plain", buffer: Buffer.from(content) },
    },
  });
  const body = (await response.json()) as { documentId: string };
  return body.documentId;
}

export async function apiCheckout(
  request: APIRequestContext,
  token: string,
  documentId: string,
): Promise<void> {
  await request.post(`${API_BASE}/documents/${documentId}/checkout`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiCheckin(
  request: APIRequestContext,
  token: string,
  documentId: string,
): Promise<void> {
  await request.post(`${API_BASE}/documents/${documentId}/checkin`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
}

export async function apiCreateUser(
  request: APIRequestContext,
  token: string,
  email: string,
  password = "User123!",
): Promise<string> {
  const response = await request.post(`${API_BASE}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { email, displayName: email, tempPassword: password, isSystemAdmin: false },
  });
  return (await response.text()).replaceAll('"', "");
}

export async function apiShare(
  request: APIRequestContext,
  token: string,
  objectType: string,
  objectId: string,
  principalId: string,
  level: string,
): Promise<void> {
  await request.post(`${API_BASE}/${objectType}/objects/${objectId}/share`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { principalId, level },
  });
}

// Signs in through the UI and returns the access token captured from the login
// response, so callers can reuse the same session for API seeding without an
// extra (rate-limited) /auth/login call.
export async function loginUi(page: Page): Promise<string> {
  const tokenPromise = page
    .waitForResponse(
      (response) => response.url().endsWith("/api/v1/auth/login") && response.ok(),
    )
    .then((response) => response.json())
    .then((body) => (body as { accessToken: string }).accessToken);

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");

  return tokenPromise;
}

export interface AdminSession {
  context: BrowserContext;
  page: Page;
  token: string;
}

// One shared, authenticated admin session for the whole suite. The auth
// endpoints are rate-limited (10 logins/minute), so specs share a single
// browser session instead of signing in per test. Playwright runs these specs
// with a single worker, so this module-level cache is stable for the run.
let cachedSession: AdminSession | null = null;

export async function getAdminSession(browser: Browser): Promise<AdminSession> {
  if (cachedSession) {
    return cachedSession;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const token = await loginUi(page);
  cachedSession = { context, page, token };
  return cachedSession;
}

export function adminRequest(
  playwright: PlaywrightTestArgs["playwright"],
  token: string,
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
