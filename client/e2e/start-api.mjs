import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..", "..", "server");
const apiDir = path.resolve(serverDir, "src", "eDMS.Api");
const dotnet = process.platform === "win32" ? "dotnet.exe" : "dotnet";
const build = spawnSync(
  dotnet,
  ["build", "eDMS.sln", "--no-restore", "--configuration", "Debug", "-m:1", "-p:UseSharedCompilation=false"],
  {
    cwd: serverDir,
    env: { ...process.env, MSBUILDUSESERVER: "0" },
    stdio: "inherit",
    windowsHide: true,
  },
);

if (build.error) {
  console.error(build.error);
  process.exit(1);
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const api = spawn(dotnet, ["bin/Debug/net10.0/eDMS.Api.dll"], {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  api.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
api.once("error", (error) => {
  console.error(error);
  process.exit(1);
});
api.once("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
