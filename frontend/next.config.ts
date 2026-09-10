import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Vercel needs the default Next output (nft traces). Standalone is for bun/self-host.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  transpilePackages: ["@privy-io/react-auth"],
  turbopack: {
    root: frontendRoot,
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  agentRules: false,
};

export default nextConfig;
