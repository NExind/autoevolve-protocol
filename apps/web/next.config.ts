import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The repository keeps its one uncommitted configuration file at the workspace
// root so the dashboard and standalone deployment scripts use the same values.
// Next otherwise only loads apps/web/.env.local because it runs from this package.
const appDirectory = dirname(fileURLToPath(import.meta.url));
loadEnv({
  path: resolve(appDirectory, "../../.env.local"),
  quiet: true,
});

const nextConfig: NextConfig = {
  transpilePackages: [
    "@autoevolve/core",
    "@autoevolve/memory",
    "@autoevolve/chain",
  ],
  serverExternalPackages: ["pinata"],
};

export default nextConfig;
