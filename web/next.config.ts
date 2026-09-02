import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres"],
  // o worker de tipos do next segfaulta em Node 24 no Windows -> a checagem de
  // verdade é `tsc --noEmit`, rodada (e obrigatória) dentro de scripts/deploy-web.sh
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
