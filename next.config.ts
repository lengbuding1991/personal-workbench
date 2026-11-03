import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [],
  webpack: (config) => { config.externals = [...(config.externals || []), "node:sqlite"]; return config; },
};

export default nextConfig;
