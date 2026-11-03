import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [],
  // 小内存机器（2G）上 next build 会在「Linting and checking validity of types」
  // 阶段再拉一个 tsc 进程，和 webpack 抢内存，直接被 OOM killer 杀掉（exit 137）。
  // 所以构建时关掉内置的类型检查与 lint，改由 npm run typecheck 单独跑一遍
  // （见 deploy/setup.sh：先 typecheck 失败即停，再 build）。安全性没有下降，
  // 峰值内存却从「两侧叠加」变成「取较大者」。
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // 只在需要时并行；小机器上少开一个 worker 就少一份内存
  experimental: { cpus: 2, workerThreads: false },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "node:sqlite"];
    return config;
  },
};

export default nextConfig;
