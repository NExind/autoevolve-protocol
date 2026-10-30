import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@autoevolve/core",
    "@autoevolve/memory",
    "@autoevolve/chain",
  ],
  serverExternalPackages: ["pinata"],
};

export default nextConfig;
