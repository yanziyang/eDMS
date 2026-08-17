import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..", "..", "server");

export default function globalSetup(): void {
  // Build the API so the webServer can run the compiled DLL directly. The API
  // migrates and seeds the E2E database itself on startup (Development/Testing).
  // Skipped when the API runs externally (E2E_API_EXTERNAL=1) — e.g. wrapped in
  // dotnet-coverage — because the running process locks the DLLs being rebuilt.
  if (process.env.E2E_API_EXTERNAL !== "1") {
    execSync(
      "dotnet build eDMS.sln --no-restore --configuration Debug -m:1 -p:UseSharedCompilation=false",
      {
        cwd: serverDir,
        stdio: "pipe",
        env: { ...process.env, MSBUILDUSESERVER: "0" },
      },
    );
  }
}
