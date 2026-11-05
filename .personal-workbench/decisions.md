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

## 2026-11-04 — 第十三～十七轮：手机端适配（弹窗居中 / 禁缩放 / 日程不显示 / 笔记分屏 / 日号对齐）

这五轮全部由用户拿手机实际使用后反馈驱动，没有一次是自己发现的。

**弹窗被底部横条挡住**：先做贴底抽屉，用户说还挡。根因是 `env(safe-area-inset-bottom)` 需要 `viewport-fit=cover` 才生效，且软键盘弹起时贴底更糟。改成垂直居中 + 限高 88vh + 中间表单滚动 + 按钮固定底部。

**iOS 输入框聚焦放大整页**：第一版强制 `font-size:16px !important` 被否（「想保持现在的字体大小」）。第二版改 viewport `maximumScale:1 + userScalable:false`，字号不动。代价是不能双指缩放整页 —— iOS 上两者无法兼得。

**手机上日程一条都不显示**：DOM 里有 2 条 `.mw-ev`，但 `.cal2-mweek` 的 computed display 是 none。原因：媒体查询里的 `.cal2-mweek{display:flex}`（第 757 行）与基础规则 `.cal2-mweek{display:none}`（第 942 行）特异性相同，后写的赢。修法是把媒体查询那条提到 `.cal2-card .cal2-mweek`（0,2,0 压 0,1,0）。**教训：媒体查询写在前面 + 同特异性 = 被覆盖。**

**手机端笔记页**：列表 + 随手记卡 + 统计 + 编辑器全纵向摞，编辑器在两屏之外。照备忘录 App 改成「列表 ⇄ 编辑」两块屏：`mEditing` 状态切 `m-list`/`m-edit` 类，编辑态隐藏侧栏与页头，顶部加返回按钮。

**首页「04」压在「三」上**：`.w-days div.today b{display:inline-grid}` 是行内级元素，不独占一行。改成所有日号统一 23px `grid` 方块，今天只多圆形底色。

## 2026-11-04 — 第十四～十六轮：日期选择器三版迭代（最终用 react-day-picker）

用户：「选择日期的那个地方点击的弹窗太丑了，丑的不得了」。

**第一版手写日历网格**：踩到 `position:fixed` 被祖先 `transform` 劫持的坑 —— `.df-pop` 渲染在 `.sheet` 内，`.sheet` 有 `animation:pin` 带 `transform:translateY(6px)`，导致弹层偏移越界。修法是 `createPortal(..., document.body)`。注意：即使动画结束后的 `matrix(1,0,0,1,0,0)` 等价于无变换，只要不是 `none` 就成立包含块。

**第二版参考 Ant Design / iOS 滚轮**：实现 `Wheel` 子组件（scroll-snap 中心吸附）。用户否：「更难看了」。

**关键认知**：那几轮用的模型不支持图片输入（`read_image` 报 `does not declare image input`），modlens 也没配 provider —— 一直在盲改。换成能读图的模型后，直接看截图才发现两个硬伤：星期表头与第一行日期挤在同一行；手机端出现两个「确定」按钮。

表头错位的根因很有意思：`.rdp-month_grid` 是 `<table>`，我给它写了 `display:flex` —— flex 让 `<thead>` 和 `<tbody>` 变成并排的 flex item。**表元素不能随便改 display。**

**第三版（采用）**：`react-day-picker@10.0.2`（shadcn/ui 的 Calendar 底层）。不覆盖内部结构，只用 CSS 变量注入主题（`--rdp-accent-color` 等），选中态从默认的「边框圈」改成实心渐变。桌面是 304px 紧凑浮层，手机是底部抽屉。

**又踩一个**：受控 `month={month}` 会让月份翻不动 —— 传了就是受控，内部状态不更新。只留 `defaultMonth`。

**教训**：看不见就别手写视觉组件，用经过验证的库；表元素别改 display；一个弹层里同一个动作只留一个按钮。

## 2026-11-04 — 第十八轮：全项目健壮性扫描

用户：「你重新扫描整理整个项目，看看还有哪里可以优化的」。这一轮不看功能，只看「出问题时用户会经历什么」。

- **零错误边界**（最严重）：`app/` 下没有任何 `error.tsx` / `not-found.tsx`，任何页面抛错就是整片白屏。补齐 `app/(app)/error.tsx`（带 `error.digest`、重试、回首页）与 `app/not-found.tsx`。
- **16 处静默失败**：29 处 `await fetch` 只有 13 处有 catch。最坏的是 `TaskModal` 保存失败仍关弹窗。新建 `lib/api.ts`（`ApiError` + `api()` + `errText()`），20 余处请求全部换过来。
- **备份日期 UTC 偏差**：`new Date().toISOString().slice(0,10)` 在北京时间 0–8 点算成前一天，导致备份该触发时不触发。新增 `todayLocal()` 手工拼本地日期。
- **13 处重复 `.map(r => ({...r}))`**：`node:sqlite` 返回 null-prototype 对象的问题，抽成 `rows<T>()` / `row<T>()` 收口。
- **提醒铃铛关不掉**：无点外部关闭、无 Esc。补 `useEffect`。
- **补 4 个索引**：`idx_task_sched`、`idx_task_done`（可进 SCHEMA），`idx_note_pin_upd`、`idx_note_arch`（**不能进 SCHEMA** —— `note.archived` 是 `ensureColumn` 后补的列，全新库建索引会报列不存在，必须放 `getDb()` 里迁移之后）。
- **删除未用依赖**：`clsx`、`tailwind-merge` 全项目 0 引用。

改动量 21 文件 +438/−247。

## 2026-11-04 — 第十九轮：版本号读 VERSION 文件（环境变量优先级陷阱）

**现象**：线上 `/api/health` 的 `sha` 一直是 `b53570b`（11-04 01:28 那版），但 `built` 是新的 `22:01`。两项本该一起变。

**排查**：直接拉 GHCR 镜像 config，里面明明是 `WORKBENCH_SHA=fa8faa5...`。`BUILD_DATE` 能正确显示、`WORKBENCH_SHA` 不能 —— 这个不对称说明**绿联界面里手工加了 `WORKBENCH_SHA` 环境变量，把镜像里的值盖掉了**（容器环境变量优先级高于 Dockerfile 的 ENV）。

**修法**：不跟环境变量纠缠。`Dockerfile` 构建时 `printf '%s\n%s\n' "${WORKBENCH_SHA}" "${BUILD_DATE}" > /app/VERSION`，`/api/health` 与设置页都优先 `readFileSync(VERSION)`，读不到才退回环境变量。

**验证**：本地无文件走兜底（`sha:"dev"`）、有文件读文件（`sha:"testsim123"`）都正确。线上重新部署后 `sha:dcde0dd...`、`built:2026-11-04 22:42`，与当次构建一致。

**教训**：要权威的版本信息就得写进镜像；排查「配置为什么不生效」先问「这个值还有哪些来源、谁优先级更高」。

## 2026-11-04 — 第二十轮：GHCR 只留最新 2 个镜像

**先纠错**：我最初说「免费额度 500MB，20 个版本超标」是**错的**。查 [GitHub Packages 计费文档](https://docs.github.com/en/billing/concepts/product-billing/github-packages)：public packages 免费，500MB/1GB 配额只约束 private 包。本项目包是 public，从没花过钱。

清理仍做，理由是快照堆到 20 个翻起来乱、也防政策变化。

**手动清理**：token 原本缺 `delete:packages`（403）。用户补权限后按 `created_at` 倒序保留最新 2 个，**20 → 2**，18 次删除全成功。顺带删掉残留仓库 `workbench-image`（204）。

**自动清理**：`.github/workflows/docker.yml` 末尾加 `actions/delete-package-versions@v5`（`min-versions-to-keep: 2`、`continue-on-error: true` —— 清理失败不该让构建显示红叉）；新建 `cleanup-images.yml` 供手动指定保留数。

**实测**：构建后清理步骤 ✅ 成功，且**没有配 `PACKAGES_PAT`** —— 说明 `GITHUB_TOKEN` 对自己仓库的包有删除权限，之前「必须 PAT」的判断偏保守。

## 2026-11-05 — 第二十一轮：项目/重复/提醒/搜索/拖拽/统计

一次性补了 8 项功能。几个关键取舍：

**重复任务 vs 重复日程，两套策略**
- 日程用「虚拟展开」：库里只存一条基准，渲染时按区间展开。理由是日程没有完成状态，展开纯粹是显示问题。
- 任务用「完成后生成下一次」：勾完一条，自动插一条新的待办。理由是任务有完成状态，虚拟展开会让同一件事在待办列表里出现十几次，反而分不清哪条能勾。
- 这个不对称是刻意的，不是实现偷懒。

**搜索放弃 FTS5**
先按计划上 FTS5，实测中文全废：默认分词器按字节切，「健身房」搜不到「今天去健身房练了腿」；trigram 只认 3 字以上，「健身」「会议」这种两个字的高频词直接 0 结果。而这个数据量 LIKE 完全够（2000 条 / 50 次查询 19ms）。所以退回 LIKE + 多词 AND + 标题加权。
教训：SQLite FTS5 对中文要额外装分词器（如 simple），不是开箱可用。

**手机端底部最多 4 个主入口**
用户明确提的约束（m15716）。侧栏 9 项直接铺到底部，每格 40px，中文两三个字就换行。改成 4 主入口 + 「更多」抽屉。
顺带发现原有的 bug：移动端 CSS 有 `.nav-foot{display:none}`，而「设置」在 `.nav-foot` 里 —— 手机上从来就进不去设置。

**拖拽排序一次写完整列**
不做「相邻两条交换」，因为拖到屏幕另一头要发好几次请求，中间断网会留下半套顺序。改成本地先排好、再批量 PATCH 整列 sort，失败整体回滚。

**自动备份按用户要求撤销**
m15815 明确「先还原，我只要能导出 workbench.db」。已删 `lib/backup.ts`、`instrumentation.ts`、`/api/backup`。留下 `/api/export-db`（先 `PRAGMA wal_checkpoint(TRUNCATE)` 再读文件，否则 WAL 里最近的写入会缺）。

**热力图只做 26 周**
53 周 × 12px = 636px，手机上横着塞不下。半年足够看出「哪段时间在持续做事、哪段时间断了」。

## 2026-11-05 — 第二十二轮：所有原生下拉换成自绘

**为什么必须自绘**：原生 `<select>` 展开的那层选项列表是操作系统画的，CSS 完全触碰不到。mac 上是系统菜单、iPhone 上是底部滚轮，跟工作台的清透蓝绿完全不搭，三端还各长各的。

**做法**：`components/Select.tsx` 一个组件，桌面是贴按钮的浮层、手机是底部抽屉。用 `createPortal` 挂 body（避免被祖先 transform 劫持，这坑在日期选择器上踩过）。带键盘操作（↑↓ 移动、↵ 选中、Esc 关闭）。

**替换范围**：13 处，覆盖首页、任务弹窗、日历弹窗、日期时间、项目弹窗、任务筛选、搜索页。

**顺带修的两个「假下拉」**：首页的「本周/上周」和「本周/本月」原来只有 `<option>` 没有 `value`/`onChange` —— 选了完全没反应，纯装饰。既然要动，就接上真实逻辑（趋势真的往前推 7 天、投入真的按整月算）。

**复选框也统一**：`accent-color` 只能改填充色，圆角和勾形状还是系统的。用 `appearance:none` 自己画了 15px 圆角方块。

**搜索页的特殊处理**：那是服务端表单（`<form action="/search">`），不是客户端状态。新建 `components/SearchType.tsx` 自己维护 state + 隐藏 input 承接提交，既保留「回车即搜」又能用自绘下拉。

## 2026-11-05 — 第二十三～二十五轮：模块关联、大屏布局、立即更新

### 模块关联（第二十三轮）
- **先出文档再动手**：用户明确「不要无脑关联，先弄一份修改文档」，产出 `模块关联设计.md` 后才开始改。
- **记录↔任务用多对多表 `note_task`**，不是外键字段。理由：一条记录可能引出好几件事，一件事也可能被好几条记录提到。
- **看板分组做三种**（状态/项目/分类），但 `data-status` 只在按状态分组时给 —— 否则在按项目视图里拖卡片，语义会变成改状态。
- **明确不做**：子任务、万能标签、双向 `[[xxx]]`、全局收件箱、日历↔任务双向拖拽、AI 自动猜项目。写进文档是为了以后不被反复提起。
- **日历任务块 id 用负数** `-t.id`，避免和日程 id 撞车；任务和日程一起参与 lane 布局。
- **点击空闲块默认只占 60 分钟**，空档再长也不全占，留余量。

### 大屏布局（第二十四轮）
- 根因是 `main` 上的 `max-width:1400px`，删掉即可覆盖 1848。
- **但只加 max-width 不居中，会把右侧空白原样搬到更宽的屏幕上** —— 必须把「侧栏+主区」当整体居中。
- 上限从 1800 放宽到 2400（用户要求 2560 屏能正常显示）；3440 上会有明显居中带，用户接受。
- **记录正文单独限宽 780**：一行 45–75 字符才是舒服的阅读区间，与屏幕宽度无关。

### 立即更新（第二十五轮）
- **根因**：`fetch(...).catch(()=>{})` 后立刻 `return`，请求上下文被拆，未建连的 fetch 被取消。实测点 4 次只有 2 次到达。
- **修法**：Next 15 的 `after()` 把发送挪到响应之后；**不设短超时**（容器被停掉导致的断连属成功路径，提前掐可能造成「容器停了没起来」）；加 20 秒冷却防连点排队重复拉 76MB。
- **前端必须给真实反馈**：轮询 `/api/health` 比对 `built`，分「正在拉 / 容器重建中 / 已更新到 X / 三分钟没变」四态。
- **教训**：「不能等响应」≠「不能 await 发送」。这轮就是被这句话带偏的。

## 2026-11-05 — 手机版做 PWA，不做原生 App / 小程序

- **决定**：只维护一套网页代码，把网页做成 PWA（可安装到主屏、全屏、有自己的图标），不做原生 App、不做微信小程序。
- **理由**：App/小程序里若装的是「网址」而非重写界面，更新服务器网页 = 所有端下次打开即新版，不用三份同时维护；小程序（个人账号 web-view 不开放 + 需 HTTPS+ICP 备案 + 纯套壳易被「功能过于简单」拒审）成本最高收益最低。
- **用起来像 App，身份上不是**：有图标、无地址栏、独立窗口、启动画面；但不在应用商店、不用审核，本质是固定到主屏幕的全屏网页。关掉后收不到推送、离线不可用（数据在 NAS）、启动有极短白屏，这些是已坦白、接受的差距。

### PWA 实现（本轮）
- **清单用 `app/manifest.ts`**（typed + Next 自动给 `application/manifest+json`），不用 `public/manifest.json`；URL 是 `/manifest.webmanifest`，需在 middleware 白名单显式放行（`.webmanifest` 不在扩展名正则里，否则未登录时 302 去 /login，安装拿不到清单）。
- **SW 只做「断网兜底页」**，绝不缓存 `/api/*`、页面 HTML、登录态、私有数据 —— 这是单用户密码登录 + 数据在 NAS + 全站 force-dynamic 的应用，缓存页面 = 把上一个登录用户的记录存进这台设备。静态资源交给浏览器 HTTP 缓存，避免 SW 缓存后更新拿旧 JS。
- **图标**：用侧栏 logo 的三白块 + 蓝绿渐变（`#5AD7C9→#35A8D8`），由 `scripts/gen_pwa_icons.py`（纯 Pillow）生成 192/512/apple-touch(180)/maskable；方块满幅无圆角无透明，让 iOS 自动切圆角、Android maskable 自裁形状都不出黑边。同时把 `app/icon.svg`（原紫色「工」形占位图）也改成同一套以保持一致。
- **iOS 状态栏**：`appleWebApp.statusBarStyle: "default"`（不透明白底、内容不被压住，避开 `black-translucent` 的重叠），另加 `@media (display-mode:standalone) and (max-width:640px)` 的 `env(safe-area-inset-top)` 兜底。
- **上线链路不变**：`pnpm push → GitHub Actions 构建 arm64 → watchtower 轮询重建`；本次改动**未推送**，等用户明确同意。

### 手机端弹窗（第二十六轮）
- **问题**：手机上填内容多的弹窗（新建任务/日程/项目）用 `.sheet` 居中 + `max-height:88vh`，几乎铺满整屏，下沿还压在底部导航条上。
- **改法**：≤640px 时 `.modal` 改成底部抽屉（`padding:0`、`align-items:flex-end`），`.sheet` 上圆角 `22px 22px 0 0`、`max-height:85dvh`（旧浏览器兜底 `85vh`，必须用 `@supports` 分开写，否则会被 CSS 压缩器合并只剩一条）、`sheetUp` 上滑动画、顶部阴影；`.acts` 底部加 `env(safe-area-inset-bottom)` 安全区，按钮不被 iPhone 底条挡住。
- **弹窗打开时隐藏底部导航 `.side` 与悬浮笔 `.capture-fab`**（`body:has(.modal)`）。`:has` 不支持的老浏览器只是导航条不隐藏，没有功能损失。
- **快速记录 `.modal.qk` 保持居中卡片**，单独补回 `padding:14px`。
- 只动 `app/globals.css`，没碰组件；`pnpm build` 通过。

### 每日习惯（第二十七轮）
- **要的是「独立打卡习惯」，不是复用重复任务**：任务那条线是「做完就消失 / 到点生成下一次」，习惯要的是「每天同一件事、连续天数、一眼看本周」。混在一起会让任务面板变脏，所以单开 `habit` + `habit_log` 两张表。
- **按天存一条，不存事件流**：`habit_log` 上 `UNIQUE(habit_id, date)`，一天点三次也只是一条，顺带防重复计数；补卡就是插一条历史日期。
- **连续天数的算法（`lib/habits.ts` 的 `computeStreak`）**：今天已打卡就从今天往前数；今天还没打卡就从昨天往前数 —— 否则每天零点一过连续天数会先跳成 0，用户会以为记录丢了。断一天即停。
- **只能补最近 60 天、不能给未来打卡**：60 天是 `LOOKBACK`，与统计的半年热力图尺度对齐；未来日期直接 400，避免「先勾上再说」把连续天数刷成假的。
- **改不动就退回**：前端 `optimistic()` 先改界面再发请求，失败回滚并 toast；服务端每次都回全量 `{ today, days, habits }`，前端整体替换，不做增量合并。
- **接口分三个**：`/api/habits`（列表 + 新建）、`/api/habits/[id]`（改名/改色/归档 + 删除，删习惯级联删打卡记录）、`/api/habits/log`（打卡/取消切换）。PATCH 找不到 id 返回 404，不是静默 200。
- **入入口放在侧栏第二组**（`secondary`）：桌面侧栏能看到，手机在底部「更多」弹层里；没有占手机底部那 4 个主入口。
- **窄屏收一号**：`@media (max-width:360px)` 把圆点 15→13px、间距 5→3px、第二行左缩进 40→34px，否则 320px 宽的 iPhone SE 上「连续 x 天 + 本周 x/7 + 7 个圆点」会挤出边框（CDP 实测原来溢出 5px）。

## 2026-11-05 — 去掉 PWA，回到普通网页模式
- **用户决定**：PWA 用不上，「把它去了吧，就正常网页模式就行」。推翻同日 `## 2026-11-05 — 手机版做 PWA，不做原生 App / 小程序` 里「做成 PWA」的那部分做法；「只维护一套网页代码、不做原生 App / 小程序」这个结论不变。
- **删掉的东西**：`app/manifest.ts`、`public/sw.js`、`public/offline.html`、`public/` 下 5 个图标（192/512/maskable/apple-touch）、`components/ServiceWorkerRegister.tsx`、`scripts/gen_pwa_icons.py`。
- **还原的改动**：`app/layout.tsx` 去掉 `manifest` / `appleWebApp` / `icons` / `themeColor` / `colorScheme` 与 `<ServiceWorkerRegister />`；`middleware.ts` 的 `PUBLIC_PATHS` 收回 `["/login","/api/auth","/api/health"]`；`app/globals.css` 删掉 `@media (display-mode:standalone)` 那段顶部安全区。
- **保留**：`app/icon.svg` 仍是蓝绿三白块（浏览器标签页 favicon），它走的是 Next 的文件约定，和 PWA 无关，且与侧栏 logo 一致。
- **副作用说明**：已经「添加到主屏幕」的设备上，那个图标会退化成普通网址书签；之前注册过的 Service Worker 会在浏览器下次检查 `sw.js` 拿到 404 后自行注销，缓存里的断网兜底页失效（本来也没有离线能力）。
