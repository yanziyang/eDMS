import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = 5190;
const WEB_PORT = 5273;
const databaseProvider = (process.env.E2E_DATABASE_PROVIDER ?? "Postgres").trim().toLowerCase();
const providerName = databaseProvider === "sqlite" ? "Sqlite" : "Postgres";
const connectionString =
  providerName === "Sqlite"
    ? "Data Source=e2e.db"
    : "Host=localhost;Port=5432;Database=edms_e2e;Username=postgres;Password=Password1";
const oidcEnabled = process.env.E2E_OIDC_ENABLED === "1";
const oidcAuthority = process.env.E2E_OIDC_AUTHORITY ?? "http://localhost:4011/default";
const samlEnabled = process.env.E2E_SAML_ENABLED === "1";
const samlIdpEntityId = process.env.E2E_SAML_IDP_ENTITY_ID ?? "urn:edms:test-saml-idp";
const samlIdpSso = process.env.E2E_SAML_IDP_SSO
  ?? "https://localhost:4443/simplesaml/saml2/idp/SSOService.php";
const samlIdpCertificate = process.env.E2E_SAML_IDP_CERT ?? "";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: "msedge",
    headless: true,
    ignoreHTTPSErrors: samlEnabled,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    ...(process.env.E2E_API_EXTERNAL === "1"
      ? []
      : [{
        // Build and run from one managed process so Playwright cannot start the
        // API while a separate setup build still has its DLLs locked.
        command: "node e2e/start-api.mjs",
        cwd: here,
        url: `http://localhost:${API_PORT}/health`,
        reuseExistingServer: false,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
        gracefulShutdown: { signal: "SIGKILL", timeout: 5000 },
        env: {
          ASPNETCORE_URLS: `http://localhost:${API_PORT}`,
          ASPNETCORE_ENVIRONMENT: "Development",
          Database__Provider: providerName,
          ConnectionStrings__Default: connectionString,
          Seed__AdminEmail: "admin@e2e.local",
          Seed__AdminTempPassword: "E2eAdmin123!",
          Client__BaseUrl: `http://localhost:${WEB_PORT}`,
          Storage__RootPath: "e2e-storage",
          Smtp__Host: "localhost",
          Smtp__Port: "1025",
          Oidc__Authority: oidcEnabled ? oidcAuthority : "",
          Oidc__ClientId: "edms-demo-client",
          Oidc__ClientSecret: "edms-demo-secret",
          Oidc__CallbackPath: "/api/v1/auth/sso/oidc/callback",
          Oidc__RequireHttpsMetadata: oidcEnabled ? "false" : "true",
          Saml__IdpEntityId: samlEnabled ? samlIdpEntityId : "",
          Saml__IdpSingleSignOnUrl: samlEnabled ? samlIdpSso : "",
          Saml__IdpSigningCertificate: samlEnabled ? samlIdpCertificate : "",
          Saml__EntityId: "urn:edms:saml",
          Saml__CallbackPath: "/api/v1/auth/sso/saml/acs",
          Saml__EmailAttributeName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        },
      }]),
    {
      command: `node node_modules/vite/bin/vite.js --port ${WEB_PORT} --strictPort`,
      cwd: here,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: "SIGKILL", timeout: 5000 },
      env: {
        VITE_API_BASE_URL: "/api/v1",
        VITE_PROXY_TARGET: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
