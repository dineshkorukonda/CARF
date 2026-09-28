import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard/installations",
        destination: "/dashboard/settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
