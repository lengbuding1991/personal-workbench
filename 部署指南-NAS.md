# 部署到绿联 NAS（不用 SSH，全在客户端里点）

> 适用：绿联 DH4300 Plus（RK3588 / arm64 / 8G），UGOS Pro，NAS 在老家、通过 Cloudflare Tunnel 访问。
> 全程只需要「绿联云客户端」+「Cloudflare 网页后台」，不需要 SSH、不需要命令行。

---

## 一、先搞清楚要做什么

三件事，顺序不能反：

1. **拉镜像** —— 代码已经由 GitHub Actions 打成 arm64 镜像，存在公开的 GHCR 里，NAS 直接拉就行。
2. **建一个 Docker 项目** —— 粘贴一段 compose，把 `workbench` 和 `watchtower` 两个容器跑起来。
3. **把域名接过来** —— 让 `workbench.lbuding.com` 经由 Cloudflare 隧道打到 NAS 的 3100 端口。

跑起来之后，更新有两种方式：

```
方式一（平时）：watchtower 每 24 小时自动查一次 → 有新镜像就自动拉取重建
方式二（想立刻用）：设置页点「立即更新」按钮 → 立刻拉最新镜像并重建（约 30 秒）
```

完整链路：

```
本地改代码 → pnpm push → GitHub Actions 构建镜像（约 4 分钟）
           → 你点「立即更新」（或等 24 小时兜底）→ 拉新镜像、重建容器
           → 刷新网页就是最新版
```

数据全程在你的 NAS 上（`/volume1/docker/workbench/data`），不经过 GitHub。

镜像信息（已核实）：`architecture: arm64`、`os: linux`、`Entrypoint: /sbin/tini -- /usr/local/bin/docker-entrypoint.sh`、`Cmd: node server.js`、`User: root`（入口脚本会自己降权到 uid 1001）、`ExposedPorts: 3100/tcp`、`VOLUME /data`。

---

## 二、拉镜像（不用再导入 tar 了）

仓库和 GHCR 包现在都是 **public**，NAS 可以直接从网上拉，不用再传 223MB 的 tar。

已验证：匿名取 token → 拉 manifest → **200**，12 个 layer 都在。

**如果你已经导入过 `workbench:latest`**：可以跳过这步，直接看第三节（把 compose 换成新版本就行，旧镜像留着当兜底）。

**如果是全新部署**：

1. 绿联云客户端 → 桌面打开 **Docker**
2. 左侧 **镜像** → **本地镜像** → 右上角 **添加**（有的版本叫「拉取」）
3. 镜像地址填：

```
ghcr.io/lengbuding1991/personal-workbench:latest
```

4. 等它拉完（约 250MB），列表里出现 `personal-workbench` 即可。

> UGOS 的「镜像仓库 → 搜索」功能是坏的（官方已知问题），**别在搜索框里找**，直接用「添加 / 拉取」填完整地址。

---

## 三、建项目（粘贴 compose）

1. Docker → 左侧 **项目** → 右上角 **创建**
2. 项目名填 **`workbench`**（必须小写）
3. 配置来源选 **「粘贴 / 编辑 compose」**，把下面整段贴进去：

```yaml
services:
  workbench:
    image: ghcr.io/lengbuding1991/personal-workbench:latest
    container_name: workbench
    restart: unless-stopped
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    ports:
      - "3100:3100"
    volumes:
      - /volume1/docker/workbench/data:/data
      - /etc/localtime:/etc/localtime:ro
    environment:
      TZ: Asia/Shanghai
      WORKBENCH_SEED: "0"
      WB_SECURE_COOKIE: "0"
      # 「立即更新」按钮要叫的 watchtower 地址和令牌（两边必须一致）
      WATCHTOWER_URL: "http://watchtower:8080"
      WATCHTOWER_TOKEN: "GCoYJ99nBwOldp1TWmAm59ZZTlurLcm4"
    mem_limit: 1500m
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  watchtower:
    image: ghcr.io/containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /etc/localtime:/etc/localtime:ro
    # 只暴露给同 compose 的 workbench 用，不映射到宿主机（外面碰不到）
    expose:
      - "8080"
    environment:
      TZ: Asia/Shanghai
      # 关键一行：绿联的 Docker 引擎较新，必须写 1.40，否则刷
      # "client version 1.25 is too old. Minimum supported API version is 1.40"
      DOCKER_API_VERSION: "1.40"
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_CLEANUP: "true"
      WATCHTOWER_ROLLING_RESTART: "true"
      # 兜底轮询：每 24 小时自动查一次
      WATCHTOWER_POLL_INTERVAL: "86400"
      # 开 HTTP API 模式，让「立即更新」按钮能主动叫它
      WATCHTOWER_HTTP_API_UPDATE: "true"
      # 开了 API 模式后默认停掉定时轮询，这行告诉它「轮询照旧」
      WATCHTOWER_HTTP_API_PERIODIC_POLLS: "true"
      # 手动触发时的令牌，必须和上面 workbench 的一致
      WATCHTOWER_HTTP_API_TOKEN: "GCoYJ99nBwOldp1TWmAm59ZZTlurLcm4"
      WATCHTOWER_NO_STARTUP_MESSAGE: "true"
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "2"
```

4. 点 **部署**（或「应用」），等两个容器都变 running。

> **老用户迁移**：如果你现在的 compose 里写的是 `image: workbench:latest`（本地导入的那个），把它改成上面 `ghcr.io/...` 那行，再在最底下补 `watchtower` 那段，重新部署一次。数据在 `./data` 里，不受影响。
>
> **已经跑着旧 watchtower 的**：把 watchtower 那段整体换成上面的（主要是加 `DOCKER_API_VERSION: "1.40"`、`expose: 8080`、`WATCHTOWER_HTTP_API_*`、`WATCHTOWER_POLL_INTERVAL: "86400"`），workbench 段补 `WATCHTOWER_URL` / `WATCHTOWER_TOKEN` 两行，再重新部署。两边的 `WATCHTOWER_TOKEN` 必须一模一样，否则点「立即更新」会被 watchtower 拒（401）。

### 这段配置里三个容易踩的点

**`/volume1/docker/workbench/data`** —— 这是存你所有数据的目录（数据库 + 每日备份）。
- UGOS Pro 的存储池一般挂成 `/volume1`；如果你有多个存储池、或者这个路径建不了，改成你实际有的，比如 `/volume2/docker/workbench/data`。
- 在客户端「文件管理」里先建好 `docker/workbench/data` 这个空文件夹也行，让系统自己建也行。
- **不用手动改属主**：镜像的入口脚本会先 `chown -R nextjs:nodejs /data` 再降权运行，所以图形界面建出来的 root 目录也能直接用。

**`WB_SECURE_COOKIE: "0"`** —— 别改成 1。
程序会自己看 `X-Forwarded-Proto` 决定要不要给 cookie 加 Secure：走 CF 隧道时是 https，它会自动加；你在家里用 `http://NAS的IP:3100` 时是 http，它不加。**强行写 1 的话，http 下浏览器会直接丢掉 cookie，登录看似成功却一直跳回登录页**（这个坑在阿里云那台已经踩过一次）。

**`/var/run/docker.sock`** —— watchtower 靠它操作容器。这是它唯一的能力，也是它唯一的风险点：挂了 socket 等于把 NAS 的 Docker 控制权交给这个容器。watchtower 是成熟的官方级项目（containrrr），镜像来自 GHCR，但你要是介意，把 `watchtower` 那段删掉，改成手动更新（见第七节末尾）。

---

## 四、先在内网验证一次

部署完，等 20 秒，在**同一个局域网**（或者你在老家的时候）浏览器打开：

```
http://NAS的IP:3100
```

应该看到「先把门锁上」的设密码页 —— 说明容器活了，数据库也建起来了。

打不开的话，按顺序查：

| 现象 | 原因 | 怎么办 |
|---|---|---|
| 容器一直 restarting | `/data` 写不进去 | 看容器日志有没有 `EACCES`；把 volumes 那行的宿主路径换成确实存在的目录 |
| 502 / 页面空白 | 容器没过健康检查 | 日志里找 `Error:` 开头的行；多半还是 `/data` 权限 |
| 端口占用 | 3100 被别的容器占了 | 把 `ports` 改成 `"3101:3100"`，重新部署 |
| `workbench:latest` 找不到 | 镜像没导进去 | 回第二步，确认本地镜像列表里真的有这个 tag |

---

## 五、接域名（已经配好了，这里是核对清单）

线上现状（已生效）：

```
workbench.lbuding.com  →  CNAME 69f29f36-6caa-4b3b-a84c-1daf4e997d6b.cfargotunnel.com  🟠 已代理
nas.lbuding.com        →  隧道 nas（NAS 管理界面，别动）
```

三条链路缺一不可，出问题就按这个表查：

| 环节 | 在哪配 | 配好长什么样 |
|---|---|---|
| 1. 隧道 Public Hostname | Zero Trust → Tunnels → `nas` → 路由 | `workbench.lbuding.com` → `HTTP` → `localhost:3100`（或 `192.168.1.197:3100`） |
| 2. DNS 记录 | 域名 `lbuding.com` → DNS → 记录 | 类型 `CNAME`，名称 `workbench`，目标 `…cfargotunnel.com`，**橙云** |
| 3. 容器监听 | compose | `ports: "3100:3100"`，容器内 `HOSTNAME=0.0.0.0` |

### 为什么会各自出错

**只有隧道没有 DNS** → 浏览器 `ERR_CONNECTION_CLOSED` 或 `NXDOMAIN`。隧道里那条只是「如果这个域名的流量进来，转给谁」，管不了域名怎么解析。

**只有 DNS 没有隧道** → CF 报 `502 Bad Gateway`（连得到 CF，但回不了源站）。

**两个都有但服务地址写错** → `502`。cloudflared 和容器在同一台 NAS 上，`http://localhost:3100` 一定通；写 `192.168.1.197:3100` 在 bridge 网络下也可能通，但 localhost 更保险。

### 怎么快速自查

```bash
# 1. DNS 有没有走 CF（应该返回 104.21.x.x 或 172.67.x.x，不是 101.200.131.44）
dig +short workbench.lbuding.com

# 2. CF 权威服务器怎么说（NXDOMAIN = 记录不存在）
dig workbench.lbuding.com A @aron.ns.cloudflare.com | grep status

# 3. 应用本身活着没
curl -s https://workbench.lbuding.com/api/health
```

第 3 条返回 `{"ok":true,"sha":"…"}` 就说明整条链路通了。

---

## 六、设密码，开始用

第一次打开会让你设一个访问密码（≥6 位，输两遍）。这个密码：
- 存在 NAS 的数据库里（scrypt 哈希，不是明文）
- **没有找回功能** —— 忘了只能改库，所以记在密码管理器里
- 连续错 6 次锁 10 分钟

设完就能用了。然后建议做两件事：

1. **填 DeepSeek Key**（设置页）—— 现在 `ai_key` 是空的，AI 拆任务 / 周复盘起稿是灰的。
2. **导出一次备份** —— 设置页「导出 JSON」，存一份到 iCloud 或网盘。

---

## 七、以后怎么更新（两种方式）

改完代码，本地两条命令：

```bash
git add -A && git commit -m "改了啥" && pnpm push
```

然后就没了。接下来分两种：

```
pnpm push
   ↓ 约 10 秒，GitHub 收到提交
GitHub Actions 构建 arm64 镜像
   ↓ 约 4 分钟（有缓存时 2 分钟）
新镜像推到 ghcr.io/…:latest
   ↓
   ├─ 方式一：设置页点「立即更新」→ 立刻拉取重建（约 30 秒）
   └─ 方式二：什么也不做 → 24 小时兜底轮询自动拉取重建
```

### 怎么用「立即更新」

1. 打开 `workbench.lbuding.com`，进「设置」页，滚到底部「更新工作台」。
2. 看「当前版本」那串短码（前 7 位），去 GitHub 的 `main` 分支最新提交对一下。
3. 点 **立即更新** → 提示「已触发更新」。
4. 等约 30 秒刷新页面，版本号变了就是成了；没变说明没新提交（或构建还没完成，再等 2 分钟点一次）。

> 构建失败 / 没新提交时，点「立即更新」版本号不会变 —— 这是正常的，不是坏了。你可以去 GitHub 的 Actions 页看构建是不是绿了。

### watchtower 只动你的工作台

compose 里的 `WATCHTOWER_LABEL_ENABLE: "true"` + workbench 容器的 `com.centurylinklabs.watchtower.enable=true` 标签，意思是：**只更新带这个标签的容器**。NAS 上其它容器（发货库存、下载器、相册之类）它一概不碰。

### 数据不会丢

数据库在 `/volume1/docker/workbench/data`，是宿主机目录挂进容器的。watchtower 重建容器时挂载点不变，`workbench.db` 一直在。每日备份 `./data/backups/workbench-YYYY-MM-DD.db` 也在那里。

### 怎么确认更新成功了

```bash
# 在绿联的「容器 → workbench → 终端」里跑
curl -s localhost:3100/api/health
```

返回的 `sha` 就是当前跑的是哪个提交。和 GitHub 上 `main` 的最新 sha 一比就知道有没有更新到。

或者直接看 watchtower 的日志：Docker → 容器 → `watchtower` → 日志，会打印 `Found new image` / `Stopping /workbench` / `Creating /workbench`。

### 想临时关掉自动更新

Docker → 项目 → `workbench` → 把 `watchtower` 那个服务停掉就行（或把 `WATCHTOWER_POLL_INTERVAL` 设成 `0`，watchtower 就跑一次就退出）。注意：停掉 watchtower 后，「立即更新」按钮也会失效（它靠 watchtower 拉镜像）。

---

## 备选方案：不想让 watchtower 碰 Docker

如果你不想把 `/var/run/docker.sock` 交给容器，两条退路：

**A. 手动更新（保留自动构建，手动拉取）**

compose 里只留 `workbench` 那段，删掉 `watchtower`。以后每次更新：

```bash
# 本地
git add -A && git commit -m "改了啥" && pnpm push
```

等 4 分钟，然后在客户端：Docker → 项目 → `workbench` → **更新**（它会 `docker pull` 新镜像并重建）。

数据在 `./data`，重建容器不影响。

**B. 用镜像 digest 锁版本**

把 `image:` 写成带完整 sha 的形式（每次构建都会打 `:${{ github.sha }}` 标签）：

```yaml
image: ghcr.io/lengbuding1991/personal-workbench:af891e2b1c3d4e5f...
```

只有你改了这行才会更新，最可控，但每次都要手改。

---

## 附：容器里到底跑了什么

| 项 | 值 |
|---|---|
| 基础镜像 | `node:24-alpine`（arm64） |
| 应用端口 | 3100（容器内固定） |
| 数据目录 | `/data`（数据库 `workbench.db` + `backups/`） |
| 运行用户 | 入口脚本 root → `su-exec` 降权到 uid 1001 `nextjs` |
| 时区 | 由 `TZ=Asia/Shanghai` + 挂 `/etc/localtime` 决定（「今天/本周」全靠它） |
| 内存上限 | 1500MB（NAS 8G，还要跑别的） |
| 健康检查 | 每 30s 打 `/api/health`（无鉴权，返回 `{ok,sha,at}`） |
| 手动更新 | 设置页「立即更新」→ workbench 容器调 watchtower 的 `POST /v1/update` |
| watchtower 兜底 | 每 24 小时查一次 GHCR `latest`，digest 变了自动重建 workbench |
| 停止信号 | tini 做 1 号进程，能干净收 SIGTERM |
