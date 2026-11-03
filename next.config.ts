import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // 给 Docker 用：产出一个自包含的 .next/standalone（连最小 node_modules 一起打包），
  // 镜像里就不必带整份依赖，也不需要源码。本地 `pnpm start` 不受影响。
  output: "standalone",
  serverExternalPackages: [],
  // 小内存机器（2G）上 next build 会在「Linting and checking validity of types」
  // 阶段再拉一个 tsc 进程，和 webpack 抢内存，直接被 OOM killer 杀掉（exit 137）。
  // 所以构建时关掉内置的类型检查与 lint，改由 npm run typecheck 单独跑一遍
  // （见 deploy/setup.sh：先 typecheck 失败即停，再 build）。安全性没有下降，
  // 峰值内存却从「两侧叠加」变成「取较大者」。
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // 只在需要时并行；小机器上少开一个 worker 就少一份内存
  experimental: {
    cpus: 2,
    workerThreads: false,
    // 客户端路由缓存：默认 force-dynamic 页面在浏览器里缓存 0 秒，
    // 于是在 首页→任务→首页 这种来回切的时候，每次都要重新绕 CF 回源一次
    // （单次 ttfb 约 1 秒）。给 30 秒后，30 秒内来回切是本地瞬间切换。
    // 数据可能滞后最多 30 秒，但每次写操作后都调了 router.refresh()，
    // 写完立刻拿到新数据，不会有「刚改完看不到」的问题。
    staleTimes: { dynamic: 30, static: 180 },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "node:sqlite"];
    return config;
  },
};

export default nextConfig;
