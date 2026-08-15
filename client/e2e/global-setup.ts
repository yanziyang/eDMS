import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..", "..", "server");

export default function globalSetup(): void {
  // Build the API so the webServer can run the compiled DLL directly. The API
  // migrates and seeds the E2E database itself on startup (Development/Testing).
  execSync("dotnet build eDMS.sln --configuration Debug", {
    cwd: serverDir,
    stdio: "pipe",
  });
}
