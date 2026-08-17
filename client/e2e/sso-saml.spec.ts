import { expect, test } from "@playwright/test";

test("signs in through the mock SAML provider", async ({ page }) => {
  test.skip(
    process.env.E2E_SAML_ENABLED !== "1",
    "Set E2E_SAML_ENABLED=1 with the containerized SAML IdP running for the real SSO E2E.",
  );

  const acsRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/auth/sso/saml/acs")) {
      acsRequests.push(request.url());
      expect(request.method()).toBe("POST");
    }
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with SAML SSO" }).click();
  await expect(page).toHaveURL(/\/saml2\/idp\/SSOService\.php/);

  await page.locator('input[name="username"]').fill("student");
  await page.locator('input[name="password"]').fill("studentpass");
  await page.locator("form").getByRole("button").first().click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "My Sites" })).toBeVisible();
  expect(acsRequests.length).toBeGreaterThan(0);
  for (const requestUrl of acsRequests) {
    expect(requestUrl).not.toContain("access_token");
    expect(requestUrl).not.toContain("refresh_token");
    expect(requestUrl).not.toContain("id_token");
  }
});
