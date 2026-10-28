import type { NextConfig } from "next";
import { resolve } from "node:path";

// Dashboard imports the backend-owned pure capability resolver. Include both
// packages regardless of which lockfile Next.js discovers on the build host.
const repositoryRoot = resolve(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root: repositoryRoot },
  outputFileTracingRoot: repositoryRoot,
  async redirects() {
    return [
      {
        source: "/dashboard/integrations",
        destination: "/docs/integrations",
        permanent: false,
      },
      {
        source: "/dashboard/installations",
        destination: "/dashboard/settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
