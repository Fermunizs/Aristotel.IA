import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // checagem de tipos roda no build local / CI
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
