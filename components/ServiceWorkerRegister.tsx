"use client";

import { useEffect } from "react";

/**
 * 注册 Service Worker。只在生产构建 + 浏览器支持 + 安全上下文
 * （HTTPS 或 localhost）下注册，开发模式不注册以免搅乱热更新。
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const { protocol, hostname } = window.location;
    const isSecure =
      protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
    if (!isSecure) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 注册失败不影响正常使用（隐私模式 / 老浏览器），静默忽略。
      });
    };

    // 等首屏资源加载完再注册，不抢带宽。
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
