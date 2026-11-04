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
    // 客户端路由缓存：这里必须给 0，不能为了省一次回源就缓存页面。
    //
    // 原先设的是 dynamic: 30，理由是「30 秒内来回切不用绕 CF 回源一次」。
    // 但 router.refresh() 只刷新「当前这一个页面」，其它页面的缓存照样是旧的：
    // 在「记录」页写完笔记，30 秒内切到「复盘」，看到的还是写之前的数量。
    // 2026-11-04 用户实际踩到：删掉 3 条灵感，切走再切回来又出现了。
    // 单人工作台里看到旧数据比多等 1 秒糟糕得多，所以这里不做路由缓存。
    staleTimes: { dynamic: 0, static: 180 },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "node:sqlite"];
    return config;
  },
};

export default nextConfig;
