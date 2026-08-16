import { test, expect } from "@playwright/test";
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
} from "./helpers";

test("sharing grants access that is enforced for search", async ({ browser, playwright }) => {
  const session = await getAdminSession(browser);
  const request = await adminRequest(playwright, session.token);
  const site = await apiCreateSite(request, session.token, "E2E Sharing");
  const libraryId = await apiGetDefaultLibrary(request, session.token, site.id);

  const sharedName = `shared-${Date.now()}.txt`;
  const secretName = `secret-${Date.now()}.txt`;
  const sharedId = await apiUpload(request, session.token, libraryId, sharedName, "shared");
  await apiUpload(request, session.token, libraryId, secretName, "secret");

  const userEmail = `viewer-${Date.now()}@e2e.local`;
  const userId = await apiCreateUser(request, session.token, userEmail);
  await apiShare(request, session.token, "Document", sharedId, userId, "Read");

  const userToken = await apiLogin(request, userEmail, "User123!");

  const sharedSearch = await request.get(
    `${API_BASE}/search?q=${encodeURIComponent(sharedName)}`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  const sharedResults = (await sharedSearch.json()) as Array<{ name: string }>;
  expect(sharedResults.some((item) => item.name === sharedName)).toBe(true);

  const secretSearch = await request.get(
    `${API_BASE}/search?q=${encodeURIComponent(secretName)}`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  const secretResults = (await secretSearch.json()) as Array<{ name: string }>;
  expect(secretResults.some((item) => item.name === secretName)).toBe(false);

  await request.dispose();
});
