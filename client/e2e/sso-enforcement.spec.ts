import { expect, test } from "@playwright/test";
import {
  ADMIN,
  API_BASE,
  adminRequest,
  apiCreateUser,
  getAdminSession,
  type AdminSession,
} from "./helpers";

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isSystemAdmin: boolean;
  localLoginDisabled: boolean;
  ssoExempt: boolean;
}

async function updateUserPolicy(
  request: import("@playwright/test").APIRequestContext,
  user: AdminUser,
  localLoginDisabled: boolean,
  ssoExempt: boolean,
): Promise<void> {
  const response = await request.put(`${API_BASE}/users/${user.id}`, {
    data: {
      displayName: user.displayName,
      isSystemAdmin: user.isSystemAdmin,
      localLoginDisabled,
      ssoExempt,
    },
  });
  expect(response.status()).toBe(204);
}

test("global SSO blocks local login but preserves the exempt admin path", async ({
  browser,
  playwright,
}) => {
  let session: AdminSession | undefined;
  const request = await (async () => {
    session = await getAdminSession(browser);
    return adminRequest(playwright, session.token);
  })();

  let admin: AdminUser | undefined;
  try {
    const usersResponse = await request.get(
      `${API_BASE}/users?search=${encodeURIComponent(ADMIN.email)}`,
    );
    expect(usersResponse.ok()).toBe(true);
    const users = (await usersResponse.json()) as AdminUser[];
    admin = users.find((user) => user.email === ADMIN.email);
    expect(admin).toBeDefined();
    if (!admin) {
      return;
    }

    // Establish the break-glass path before enabling the global switch.
    await updateUserPolicy(request, admin, false, true);
    const blockedEmail = `sso-blocked-${Date.now()}@e2e.local`;
    const blockedId = await apiCreateUser(request, session!.token, blockedEmail, "Blocked123!");
    const blockedUser: AdminUser = {
      id: blockedId,
      email: blockedEmail,
      displayName: blockedEmail,
      isSystemAdmin: false,
      localLoginDisabled: false,
      ssoExempt: false,
    };
    await updateUserPolicy(request, blockedUser, false, false);

    const enableSso = await request.put(`${API_BASE}/admin/settings`, {
      data: { ssoEnforcedGlobally: true },
    });
    expect(enableSso.status()).toBe(204);

    const blockedContext = await browser.newContext();
    try {
      const blockedPage = await blockedContext.newPage();
      await blockedPage.goto("/login");
      await blockedPage.getByLabel("Email address").fill(blockedEmail);
      await blockedPage.locator("#login-password").fill("Blocked123!");
      await blockedPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(
        blockedPage.getByText("This account requires SSO — use the configured SSO button above."),
      ).toBeVisible();
      await expect(blockedPage).toHaveURL(/\/login$/);
    } finally {
      await blockedContext.close();
    }

    const exemptContext = await browser.newContext();
    try {
      const exemptPage = await exemptContext.newPage();
      await exemptPage.goto("/login");
      await exemptPage.getByLabel("Email address").fill(ADMIN.email);
      await exemptPage.locator("#login-password").fill(ADMIN.password);
      await exemptPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(exemptPage).toHaveURL("/");
      await expect(exemptPage.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    } finally {
      await exemptContext.close();
    }
  } finally {
    if (admin) {
      // Restore the seeded database so later specs can use ordinary local login.
      await request.put(`${API_BASE}/admin/settings`, {
        data: { ssoEnforcedGlobally: false },
      });
      await updateUserPolicy(request, admin, false, false);
    }
    await request.dispose();
  }
});
