import type { MetadataRoute } from "next";

/**
 * PWA 清单。Next.js 会把它生成为 `/manifest.webmanifest`，
 * 并以正确的 `application/manifest+json` Content-Type 返回。
 *
 * 图标都是相对路径，域名换了也不用改；方块满幅、无圆角、无透明，
 * 是为了让 iOS 自动切圆角、Android maskable 自己裁形状时都不出黑边。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "个人工作台",
    short_name: "工作台",
    description: "本地优先的个人工作台：任务、日程、记录、复盘与 AI 助手",
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#EFF6FC",
    theme_color: "#EFF6FC",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
