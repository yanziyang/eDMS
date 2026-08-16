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

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: "msedge",
    headless: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    ...(process.env.E2E_API_EXTERNAL === "1"
      ? []
      : [{
        // Run the built DLL directly (not `dotnet run`) so the server process is the
        // one Playwright manages and no orphaned apphost survives a stopped run.
        command: "dotnet bin/Debug/net10.0/eDMS.Api.dll",
        cwd: path.resolve(here, "..", "server", "src", "eDMS.Api"),
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
