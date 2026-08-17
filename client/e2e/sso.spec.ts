import { expect, test } from "@playwright/test";

test("signs in through the mock OIDC provider", async ({ page }) => {
  test.skip(
    process.env.E2E_OIDC_ENABLED !== "1",
    "Set E2E_OIDC_ENABLED=1 and start the M20.3 mock provider for the real SSO E2E.",
  );

  const callbackUrls: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().includes("/sso/complete")) {
      callbackUrls.push(request.url());
    }
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with SSO" }).click();
  await expect(page).toHaveURL(/\/default\/authorize/);

  await page.locator('input[name="username"]').fill("demo-user");
  const password = page.locator('input[name="password"]');
  if (await password.count()) {
    await password.fill("demo-password");
  }
  await page.locator("form").getByRole("button").first().click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "My Sites" })).toBeVisible();

  for (const callbackUrl of callbackUrls) {
    const query = new URL(callbackUrl).searchParams;
    expect(query.has("access_token")).toBe(false);
    expect(query.has("id_token")).toBe(false);
    expect(query.has("refresh_token")).toBe(false);
  }
});
