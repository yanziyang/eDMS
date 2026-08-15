import type { APIRequestContext, Page } from "@playwright/test";
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

export async function loginUi(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
