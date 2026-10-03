// Builds and serves production from a separate dist dir so a running
// `next start` (using .next) is never touched. Cross-platform (no `VAR=x cmd`).
import { spawnSync, spawn } from "node:child_process";
import { createRequire } from "node:module";

const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-prod2",
};
const port = process.env.PORT || "3001";

const build = spawnSync(process.execPath, [next, "build"], { env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

spawn(process.execPath, [next, "start", "-p", port], { env, stdio: "inherit" }).on(
  "exit",
  (code) => process.exit(code ?? 0),
);
