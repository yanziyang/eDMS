import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs BEFORE Playwright (and therefore before the API webServer) so the SQLite E2E
// database from a previous run can be removed while no process holds it open. The API
// recreates e2e.db and migrates/seeds it on startup (Development).
const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, "..", "..", "server", "src", "eDMS.Api");
const provider = (process.env.E2E_DATABASE_PROVIDER ?? "Postgres").trim().toLowerCase();

if (provider === "sqlite") {
  for (const file of ["e2e.db", "e2e.db-wal", "e2e.db-shm"]) {
    rmSync(path.join(apiDir, file), { force: true });
  }
}
rmSync(path.join(apiDir, "e2e-storage"), { recursive: true, force: true });
