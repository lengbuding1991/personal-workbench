// 个人工作台 · Service Worker
//
// 只做一件事：断网、且请求的是「页面导航」时，给一张友好的兜底页，
// 并满足浏览器判定「可安装 PWA」的最低要求（有 fetch 处理器）。
//
// 刻意【不】缓存任何别的东西：
//   · /api/*       —— 含登录态、私有数据，缓存会串号
//   · 页面 HTML    —— 所有页面 force-dynamic，缓存会显示过期数据
//   · /_next 静态  —— 交给浏览器自身的 HTTP 缓存，避免 SW 缓存后更新拿旧 JS
//
// 这是单用户密码登录、数据全在 NAS 上的应用，缓存页面等于把上一个
// 登录用户的记录存进这台设备，绝对不能做。

const CACHE = "workbench-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 只拦截「整页导航」（刷新、直接输入网址、点外链），
  // 其余（API、/_next 静态资源、客户端路由的 RSC 请求）一律放行直连。
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    })
  );
});
