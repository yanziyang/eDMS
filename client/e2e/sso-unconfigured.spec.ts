import { expect, test } from "@playwright/test";

test("does not show broken SSO entry points when providers are not configured", async ({ page }) => {
  test.skip(
    process.env.E2E_OIDC_ENABLED === "1" || process.env.E2E_SAML_ENABLED === "1",
    "Run this case with both test IdP flags disabled.",
  );

  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in with/ })).toHaveCount(0);
  await expect(page.getByText("Failed to load SSO providers.")).toHaveCount(0);

  const oidcChallenge = await page.request.get("/api/v1/auth/sso/oidc/challenge");
  const samlChallenge = await page.request.get("/api/v1/auth/sso/saml/challenge");
  expect(oidcChallenge.status()).toBe(404);
  expect(samlChallenge.status()).toBe(404);
  expect(pageErrors).toEqual([]);
});
