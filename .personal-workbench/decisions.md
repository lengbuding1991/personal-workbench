# 个人工作台 — Decision Log

Append dated, confirmed decisions below. Do not rewrite earlier entries silently.

## 2026-11-02 — 形态：人生工作台，而非单一场景工具

- 决定：按「底座 + 可插拔模块」设计，第一版做通用底座。
- 理由：用户明确说「这个其实可以是我的人生工作台，我以后的人生会不断完善这个项目」，且同时有工作、副业、自媒体、研究生四条线。
- 待确认：第一版具体聚焦范围。

## 2026-11-02 — 数据形态：本地优先，之后由用户自行部署

- 决定：V1 单机本地运行，SQLite 单文件；不做登录、不做云同步。
- 理由：用户原话「虽然是多端都要，但是我想先本地的完成了，我自己再部署到服务器上去」。
- 约束：公网部署前必须加访问密码（预留 AUTH_MODE）。

## 2026-11-02 — 隐私：V1 不处理，但预留

- 决定：暂不做加密/登录；数据只存在本机 `data/`。
- 理由：用户「只是我个人使用，因为暂时只存在本地，所以先不考虑隐私问题」。

## 2026-11-02 — 视觉：深色科技感

- 决定：深色底 + 电光青强调 + 数据感，参考 Linear / Vercel / Raycast。
- 理由：用户在选项中明确选择「深色科技感」。

## 2026-11-02 — 知识库：只留接口，不实现

- 决定：新增 `external_ref` 表与 `/api/kb/link` 契约，不建知识库功能。
- 理由：用户「知识库我后面会单独再建，你能引用就行，知识库这个暂时不用，留个接口就行」。

## 2026-11-02 — 技术栈：Next.js 15 + SQLite + Tailwind/shadcn

- 决定：Next.js（App Router）+ TypeScript + Tailwind v4 + shadcn/ui + better-sqlite3 + Drizzle + FTS5。
- 理由：单进程易部署、AI 密钥可留在服务端、PWA 与深色 UI 生态成熟；SQLite 零运维、备份即拷文件。
- 备选：Vite + Express（更轻，但部署与 SSR 生态弱）；单文件 HTML（不选，无法长期扩展与跨设备）。

## 2026-11-02 — 参考抖音「个人工作台」趋势，但不照抄

- 观察：主流形态是单文件 HTML + localStorage，模块为习惯/记账/热力图/学习目标，靠 JSON 导出备份。
- 决定：保留其好看好用，但改用数据库 + 服务端 + 可部署架构。
- 理由：用户要长期用、要自己部署、要加模块，单 HTML 无法支撑。

## 2026-11-02 — V1 范围确认：P0 16 项全要，模块后加

- 决定：第一版交付全部 16 项 P0；习惯打卡/记账/学习目标/自媒体选题/项目看板均不做，留到模块期。
- 理由：用户在 17 选项弹窗中选择「全部 16 项都要」，并明确模块先不加。
- 约束：开工前必须先用弹窗向用户确认技术方案，用户确认后才可写代码；用户要求先本地完成，之后自行部署。

## 2026-11-02 — 技术方案确认：Next.js + SQLite；原型用独立 HTML

- 决定：正式实现用 Next.js 15 + SQLite（详见上条）；UI 原型阶段用 3 个独立 HTML，浏览器直接打开。
- 理由：用户在弹窗中确认「Next.js + SQLite」与「3 个独立 HTML」；原型可丢弃，不污染正式代码。

## 2026-11-02 — AI 供应商：DeepSeek

- 决定：默认接 DeepSeek（OpenAI 兼容），base_url 为 https://api.deepseek.com，模型 deepseek-chat；key 由用户后续填入，存服务端配置/环境变量，不进前端。
- 理由：用户选择 DeepSeek（便宜、中文好）。
- 待办：用户提供 API key 后才能真跑；未填时 AI 按钮置灰并提示「去设置里填 key」。

## 2026-11-02 — 视觉改版：暖白工作室风（推翻深色科技感）

- 决定：以用户提供的创作者工作台参考图为准，V1 采用奶油暖白 + 淡紫 + 马卡龙点缀；深色方案（A/B/C）只存档，不做主线。
- 理由：用户看到 C 的 4 套深色主题后，直接发参考图并要求“做成这样子的配色和布局”；此前“深色科技感”的选择已被新参考覆盖。
- 原型：`prototypes/d-studio.html`；截图 `screens/d.png`、`d-inspire.png`、`d-notes.png`。
- 用户确认（2026-11-02）：“暂时先这样，后续配色布局什么的再说吧” → 记为 ui_confirmed，后续允许微调。
- 影响：开发文档第 11 节已按暖白风改写；深色 token 保留在 C 原型里，作为以后可选主题。

## 2026-11-02 — 实现阶段技术调整

- better-sqlite3 在 Node v24.22.1（ABI node-v137）原生编译失败，改用 Node 内置 `node:sqlite` 的 `DatabaseSync`，零原生依赖，跨机器可复现。
- 端口固定 3100：3000 被本机「大灯库存台」占用，Next 监听 IPv6 导致 localhost 串台。
- 设计系统直接从 `prototypes/d-studio.html` 移植为 `app/globals.css`，保证正式版与确认稿视觉一致。
- 任务用 `project` 文本 + `tags` 文本（逗号分隔）承载项目/标签，不走独立 project/tag 表，降低 V1 复杂度；表结构保留 `project` 表供以后迁移。
- 自动备份用 SQLite `VACUUM INTO`，每天首次打开时执行，保留 14 份。
- 提醒仅页面内 + 浏览器通知，遵守 P0 边界，不做关页推送。

## 2026-11-02 — 视觉改版第二轮：清透蓝绿成长工作台（推翻暖白手账）

- 决定：按用户第二次提供的参考图（浅蓝白 + 青绿 + 成长总览），全站改为清透蓝绿成长风；暖白 D 方向归档到 `prototypes/d-studio.html`，不再作为主线。
- 理由：用户在成品上直接发参考图并要求「你重新改成这样的配色样式和布局，你可以再美化下」；暖白手账感被明确覆盖。
- 影响范围：`app/globals.css` 全文重写（token + 类名），`Sidebar`/`TopBar`/`Dashboard`/`StatsApp`/`TasksPage`/`NotesApp`/`CalendarApp`/`ReviewApp`/`AiApp`/`SettingsApp` 配色与文案同步；`开发文档.md` 第 11 节、第 14 章第 6 条重写；`README.md` 同步。
- 用户确认（2026-11-02）：「重新改成这样的配色样式和布局」，并授权「你再美化下」的自由度 → 记为 ui_confirmed（choice E）。
- 经验：把参考图的构图（KPI 行 / 趋势 + 环形 / 列表 + 月历 / 模块网格 / 小结 + 金句）直接落到组件，比逐页微调更快收敛。

## 2026-11-02 — 第三轮：不加新功能，只优化既有体验

- 决定：按用户 m01660 的要求「在增加新功能前，先对现有功能做详细优化」，本轮只改交互手感，不新增模块。
- 已改七项：
  1. 任务三态（`todo/doing/done`）补齐入口：看板卡片「开始做」按钮、编辑弹窗状态分段控件。
  2. 全部任务操作改乐观更新（`lib/use-tasks.ts`），删除延迟 6 秒落库、提示条可撤销；记录与日程删除同样可撤销。
  3. 日历里点日程改为打开编辑弹窗（此前是点击即删除，属于危险设计）。
  4. `⌘K` 命令面板支持 `↑` `↓` `↵`，高亮当前行，输入的关键词可直接记成一条记录。
  5. 周复盘接上 AI 起稿（`/api/ai` 的 `review` 增加 `type: weekly`，汇总本周完成/逾期/记录/日复盘）。
  6. 任务页新增多选批量：完成 / 进行中 / 删除 / 全选未完成。
  7. 统一 `useToast()` 提示条（最多 3 条、5.2 秒、可带一个操作按钮）。
- 教训（重要）：用 CDP 自动化点真实按钮会真的改数据。本轮测试「批量标记完成 + 删除」后，直接从 `data/backups/` 整库覆盖恢复，**把用户刚填的 DeepSeek Key 一起覆盖掉了**（备份生成于 Key 写入之前）。以后自动化测试一律用 `WORKBENCH_DATA_DIR` 指向临时目录的独立实例，禁止在用户真实库上连点破坏性操作。

## 2026-11-02 — 第四轮：日历重做 + 拖拽

- **任务卡片可拖拽**：新增 `lib/use-pointer-drag.ts`（鼠标 5px 阈值、触屏长按 220ms）与 `components/DragGhost.tsx`；任务面板与首页看板共用，落点用 `elementFromPoint().closest("[data-status]")` 判定列。
- **日历重写为时间轴**：放弃列表式周视图，改 6:00–24:00 小时网格（每小时 48px），全天行独立，重叠日程 lane 算法并排；日程可上下左右拖动（15 分钟吸附）与底部拉伸改时长；任务小卡可拖到某天改 `due_date`。
- **日视图侧栏**：292px「本周任务 / 空闲时间 / 今日统计」，空档可一键排程；手机 <760px 默认日视图。
- **测试隔离**：沿用上轮教训，拖拽测试全部跑在 `WORKBENCH_DATA_DIR=/tmp/wb-test` + 3300 端口。

## 2026-11-03 — 第六轮：任务页收尾区（不靠拉高容器）

- 背景：看板列改为内容高度后，任务页下方空出一大块；用户上一轮已明确否决「为填满而拉高三列」。
- 决定：**用真实内容补位，而不是拉伸容器** —— 看板下新增 `.tasks-extra` 两栏：「最近七天收尾节奏」（7 条横向进度行 + 本周合计/日均）与「刚刚做完的」（最近完成 4 条 + 补位虚线提示 + 累计统计）。
- 取舍：「最近七天」初版是竖向柱状图，7 根柱在 232px 里又细又空，改成横向进度行后与看板卡片语言一致、信息更密。
- 修了 `.te-row` 的对齐 bug：`justify-content:normal` + `b{flex:0 1 auto}` 导致标题不占满、圆勾左侧空 100px；改 `.te-done .te-row{justify-content:flex-start}` + `b{flex:1 1 auto}`。
- 设置页「你积累了多少」四宫格改 `flex:1` + `grid-auto-rows:1fr` + 数字 24px，撑满右栏剩余高度。
- 结果：1440/1228 下 `/tasks` docH 均为 1000（一屏铺满），无底部空洞；tsc、build 通过，9 路由 200。

## 2026-11-03 — 第七轮：日历 bug（6 点之前看不到）

- 用户反馈：「我已经拉到最上面了，但是 6 点之前完全没有展示」。根因不是滚动，而是 `components/CalendarApp.tsx` 的 `DAY_START = 6` —— 时间轴压根没渲染 0:00–6:00。
- 决定：**日历覆盖完整 24 小时**（`DAY_START = 0`、`DAY_END = 24`、每小时仍 48px，网格高 1152px），而不是「加个提示说 6 点前没有」。
- 凌晨不显空的做法：0–6 点每列加淡灰蓝渐变带 `.cal2-night` + 刻度用更浅的灰与点线；同时把「空闲 N 小时」徽标限制在 7:00–23:00（`GAP_START` / `GAP_END`），避免凌晨被标成大片空闲。
- 初始滚动改为「当前时间往前 3 小时」，取代原来固定早上 8 点。
- 验收：`/tmp/cal4.mjs` 在 `scrollTop=0` 时确认 `00:00` 可见且 gutter 与全天行不重叠（283/283）；周/日/390px 三张截图复查。

## 2026-11-03 — 第八轮：登录与访问控制

- 用户：「你先更新下登录功能，登录后才能看」。单人工作台，只需要一道门，不需要角色权限。
- 决定：**单密码 + 自校验 cookie，不建 session 表**。密码 scrypt（N=16384/r=8/p=1）哈希存 `setting.auth_hash`；cookie 值 `<过期戳>.<HMAC>`，HMAC 密钥由密码哈希派生 —— 改密码即让所有旧 cookie 失效，不用维护失效名单。
- 分层：`middleware.ts`（edge）只粗筛 cookie 是否存在/过期；真实验签在 `app/(app)/layout.tsx` 与 `lib/auth.ts:requireAuth()`（那里能读 SQLite）。
- 路由重组：页面全部搬进 `app/(app)/`，`app/layout.tsx` 只留 html/body + 备份触发，`components/AppShell.tsx` 承载侧栏与全局弹层 —— 登录页因此不带侧栏。
- API 全部加锁：14 个路由的每个 handler 首行 `requireAuth()`，未登录 401，避免绕页面直接取数。
- 顺带修 bug：清空数据后首页 `TypeError: Cannot read properties of undefined (reading 'pct')`，`components/Dashboard.tsx` 的 `invest[0].pct` 改 `invest[0]?.pct`。
- 坑：`Set-Cookie` 带 `secure` 时本机 http 会被浏览器丢弃，登录「成功」却跳回登录页；改为 `WB_SECURE_COOKIE=1` 才开启。
- 节流：同 IP 10 分钟错 6 次锁 10 分钟；密码错误文案逐次递减。

## 2026-11-03 — 第九轮：部署到阿里云 + 自动更新

**为什么不用 GitHub Actions / Webhook**：仓库得能让阿里云那台机器主动拉，而这台机器
到 `github.com:443` 的 TLS 会被掐断（`GnuTLS recv error -110`），只有 `api.github.com`
和 `codeload.github.com` 通。所以走「服务器上 systemd timer 每 5 分钟问 API 要 main 的 sha
→ 不一样就从 codeload 下 tar.gz → 解压覆盖 → 构建 → 重启」。

**为什么不用 `git pull`**：同上，`github.com` 不通。副作用是删掉的文件不会跟着消失，
所以推送脚本和部署脚本两侧都补了「显式删除」：远端 tree 用 `sha:null` 删条目，
服务器解压时用 `--exclude='*/data'` 保住数据。

**端口 3200 而不是 3000**：同一台机器上发货库存占了 3000。应用只监听 `127.0.0.1`，
nginx 反代。

**定时器叫 `workbench-update.timer` 而不是 `update-check.timer`**：发货库存已经有
一个 `update-check.timer`，同名会被覆盖，导致它的自动更新静默失效。`OnBootSec=4min`
错峰，避免和它在同一秒抢带宽。

**Secure cookie 跟着 HTTPS 结果走**：`workbench.service` 默认 `WB_SECURE_COOKIE=0`，
`sеtup.sh` 在证书申请成功后改成 1。否则「证书没申请下来 + 强制 Secure」会让浏览器在
http 下直接丢掉 cookie，登录看似成功却一直跳回登录页（本地开发已经踩过一次）。

**上线不灌示例数据**：`workbench.service` 里 `WORKBENCH_SEED=0`，`lib/db.ts` 的 seed
条件加了 `&& process.env.WORKBENCH_SEED !== "0"`。线上首启是空库。

## 2026-11-03 — 第十轮：线上部署排错

- **构建 OOM（exit 137）**：next build 里 tsc 与 webpack 抢内存，2G 机器必死。决定关掉构建期类型检查，
  改由 `pnpm typecheck` 前置独立跑；构建堆上限 1024；小内存机自动补 1G swap。
- **登录跳转不能用 middleware 发绝对地址**：`next start -H 127.0.0.1` 下 Next 的 self origin 是
  `http://localhost:3200`，用户会被送去自己电脑的 3200 端口。试过 X-Forwarded-Host 与相对 Location
  两条路都失败（后者 500 `TypeError: Invalid URL`）。最终把页面跳转挪到 `app/(app)/layout.tsx`，
  用 `redirect('/login')` 发相对 307；middleware 只保留 API 401 与 `x-wb-next` 透传。
- **Cloudflare 保持灰云**：解析直连服务器，证书由本机 certbot 签。开橙云需先设 Full (strict)。

## 2026-11-04 — 第十一轮：迁移到绿联 NAS（Docker + watchtower）

**为什么迁**：阿里云那台只有 2G 内存，`next build` 峰值把内存吃光、疯狂 swap，整机用户态卡死（内核还活着，TCP accept 正常，但所有应用都不响应），控制台「重启」都发不进关机信号，只能强制停止。加了 swap + flock + 内存预检也治不了根 —— 那台机器同时还在跑发货库存。

**为什么用 Docker**：用户明确不用 SSH，只在绿联云客户端里点。UGOS Pro 有 Docker 图形界面，是唯一可行路径。

**镜像怎么来**：本机是 mac（arm64）但没装 Docker，NAS 也不能 `compose build`（GUI 项目页只能 pull）。所以用 GitHub Actions 的 **原生 arm64 runner**（`ubuntu-24.04-arm`）构建并推 GHCR。第一次用 `ubuntu-latest` + QEMU 失败：`qemu: uncaught target signal 4 (Illegal instruction)` → exit 132，SWC 的原生二进制在模拟器里跑不了。

**为什么要改 public**：包是 private → 匿名拉取 401。GitHub REST **没有**改包可见性的接口（各种 Accept 头都 404，GraphQL `user.packages` 返回空），只能网页点一次。仓库改 public 可以用 API（`PATCH /repos/{owner}/{repo} {"private":false}` 有效），但包不行。公开前扫过：`.gitignore` 已排除 `data/`、`/screens/`，全历史无真实 token（只有 `ghp_xxx` 占位符），101 个纯源码文件。

**为什么加 watchtower**：用户要求「本地 push 完，NAS 直接更新，我打开网站就是最新」。watchtower 挂在 `ghcr.io/containrrr/watchtower`（有 linux/arm64 子清单），`WATCHTOWER_POLL_INTERVAL=300` + `WATCHTOWER_LABEL_ENABLE=true`，只更新打了 `com.centurylinklabs.watchtower.enable=true` 标签的容器，不碰 NAS 上其它服务（发货库存、下载器等）。`WATCHTOWER_CLEANUP=true` 防止 76MB 镜像越积越多把系统盘吃满。

**导入 tar 的两轮失败（留给以后参考）**：
1. 第一次打的 tar 是 OCI/containerd 布局（`blobs/sha256/…`），UGOS 导入器不认。
2. 转成 `docker save` 老布局仍然失败 —— 真因是 macOS 的 `bsdtar` 因为文件带扩展属性，给每个成员加了 **PaxHeader** 扩展头，严格的 ustar 解析器直接判为未知格式。最后用纯 Node 手写严格 ustar（512 字节块、八进制字段、`ustar\0`+`00`、结尾两个全零块）才通过。

**线上跳转 localhost 的坑**：`middleware.ts` 原本用 `req.nextUrl.clone()` 拼 `/login`，Next 在 `next start -H 127.0.0.1 -p 3200` 下把自己 origin 认成 `http://localhost:3200`，于是 307 到用户自己电脑的 3200。改用 `X-Forwarded-Host` / `Host` 也不行（Next 会改写 Host）。**最终方案：middleware 不发任何 redirect**，只把原路径写进 `x-wb-next` 请求头放行，由 `app/(app)/layout.tsx` 的服务端 `redirect("/login")` 发相对 307，浏览器按当前域名补全。

## 2026-11-04 — 第十二轮：切页卡顿治理（骨架屏 + 进度线 + 路由缓存）

**现象**：用户说在 `https://workbench.lbuding.com` 点侧栏「感觉很卡」。

**实测拆因**：本机直连 `/` ttfb 0.0087s，经 CF 后 0.84–1.11s；`cf-ray` 落在 `SJC`/`LAX`/`BOS`（美国），对手机在上海；HTML 是 `no-store` + `DYNAMIC`，每次切页都回源到老家 NAS；静态 chunk 是 `HIT` + `immutable`，没问题。

**结论**：慢在链路（改不了），但界面在那 1 秒里完全不动（能改）。

**改动**：
1. `app/(app)/loading.tsx` 骨架屏 —— 仓库此前 `loading.tsx` 数量为 0。
2. `components/NavProgress.tsx` + `.nav-progress` 顶部 2px 进度线；`Sidebar` 的 `<Link>` 加 `onClick={ping}` 派发 `wb:nav-start`。
3. `next.config.ts` 的 `experimental.staleTimes: { dynamic: 30, static: 180 }` —— 默认 dynamic 缓存 0 秒，来回切页每次回源。
4. 去掉 `.side` 与 `.login-card` 的 `backdrop-filter: blur(20px)`，`.blobs i` 的 `blur(100px)` 降到 `72px`。

**为什么用「自定义事件 + pathname 变化」判断导航进度**：Next 15 App Router 没有暴露 route-change 事件，`useRouter` 也没有 `events`。用 `pathname` 变化做结束信号 + 4 秒兜底，是客户端能拿到的最可靠信号。

**为什么不把页面改成 ISR 或静态**：全部页面服务端直读 SQLite 且要登录态，静态化会把「别人能不能看」变成构建期决定，安全性下降；`force-dynamic` 必须留。
