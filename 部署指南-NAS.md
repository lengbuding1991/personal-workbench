# 部署到绿联 NAS（不用 SSH，全在客户端里点）

> 适用：绿联 DH4300 Plus（RK3588 / arm64 / 8G），UGOS Pro，NAS 在老家、通过 Cloudflare Tunnel 访问。
> 全程只需要「绿联云客户端」+「Cloudflare 网页后台」，不需要 SSH、不需要命令行。

---

## 一、先搞清楚要做什么

三件事，顺序不能反：

1. **把镜像导进 NAS** —— NAS 上的 Docker 只能拉公开镜像，我们的镜像是私有的，所以用文件导入。
2. **建一个 Docker 项目** —— 粘贴一段 compose，把容器跑起来。
3. **把域名接过来** —— 你 CF 里那条 `workbench.lbuding.com` 现在指向老服务器（101.200.131.44），要改成走隧道。

镜像已经构建好并打包在本地：

```
~/Downloads/workbench-nas-classic.tar      （223MB，给 GUI 导入用）
~/Downloads/workbench-nas-classic.tar.gz   （74MB，上传慢就用这个）
```

> 之前那份 `workbench-arm64-image.tar` 导不进去，是因为它是 OCI/containerd 布局（`blobs/sha256/…`），UGOS 的导入器只认 `docker save` 产出的老格式（一堆 `<层ID>/layer.tar` + `manifest.json` + `repositories`）。现在这两份已经是老格式，直接导入就行。

镜像信息（已核实）：`architecture: arm64`、`os: linux`、`Entrypoint: /sbin/tini -- /usr/local/bin/docker-entrypoint.sh`、`Cmd: node server.js`、`User: root`（入口脚本会自己降权到 uid 1001）、`ExposedPorts: 3100/tcp`、`VOLUME /data`。

---

## 二、导入镜像（约 3~5 分钟，取决于你的上行带宽）

1. 绿联云客户端 → 桌面打开 **Docker** 应用
2. 左侧 **镜像** → 上方 **本地镜像** → 右侧 **添加 / 导入**
3. 选择 `workbench-nas-classic.tar` 上传

上传完等它解包，列表里会出现一个 **`workbench:latest`**，大小约 250MB（压缩包 223MB，解压后是这么多，正常）。

> 传大文件慢的话，用 `.tar.gz` 那份（74MB），UGOS 的导入器两种都吃。
> 如果客户端里根本找不到「导入」按钮，就去 **镜像仓库列表 → 新建加速器** 先配个源，再回来找；实在没有，看文末「备选方案」。

---

## 三、建项目（粘贴 compose）

1. Docker → 左侧 **项目** → 右上角 **创建**
2. 项目名填 **`workbench`**（必须小写）
3. 配置来源选 **「粘贴 / 编辑 compose」**，把下面整段贴进去：

```yaml
services:
  workbench:
    image: workbench:latest
    container_name: workbench
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - /volume1/docker/workbench/data:/data
      - /etc/localtime:/etc/localtime:ro
    environment:
      TZ: Asia/Shanghai
      WORKBENCH_SEED: "0"
      WB_SECURE_COOKIE: "0"
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
```

4. 点 **部署**（或「应用」），等容器变 running。

### 这段配置里两个容易踩的点

**`/volume1/docker/workbench/data`** —— 这是存你所有数据的目录（数据库 + 每日备份）。
- UGOS Pro 的存储池一般挂成 `/volume1`；如果你有多个存储池、或者这个路径建不了，改成你实际有的，比如 `/volume2/docker/workbench/data`。
- 在客户端「文件管理」里先建好 `docker/workbench/data` 这个空文件夹也行，让系统自己建也行。
- **不用手动改属主**：镜像的入口脚本会先 `chown -R nextjs:nodejs /data` 再降权运行，所以图形界面建出来的 root 目录也能直接用。

**`WB_SECURE_COOKIE: "0"`** —— 别改成 1。
程序会自己看 `X-Forwarded-Proto` 决定要不要给 cookie 加 Secure：走 CF 隧道时是 https，它会自动加；你在家里用 `http://NAS的IP:3100` 时是 http，它不加。**强行写 1 的话，http 下浏览器会直接丢掉 cookie，登录看似成功却一直跳回登录页**（这个坑在阿里云那台已经踩过一次）。

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

## 五、接域名（这是你现在最卡的一步）

先看清楚现状（我刚查的）：

```
workbench.lbuding.com  →  101.200.131.44     ← 还是老阿里云那台
nas.lbuding.com        →  104.21.34.41 / 172.67.196.249   ← 已经走 CF 隧道了
```

所以你 CF 后台的隧道 `nas` 里虽然有 `workbench.lbuding.com` 这条**路由**，但**DNS 记录还指着老服务器**，请求根本没进隧道。这就是为什么 `https://workbench.lbuding.com` 打不开（那台机器上的服务已经被我们清掉了）。

### 要做两步

**第一步：改隧道的服务地址**

Cloudflare → Zero Trust → Networks → Tunnels → 点 `nas` → **路由** → 找到 `workbench.lbuding.com` → 编辑：

- **服务类型**：`HTTP`
- **URL**：`localhost:3100`

（`nas.lbuding.com` 那条别动，它是 NAS 自己的管理界面。）

**第二步：改 DNS 记录**

Cloudflare → 你的域名 `lbuding.com` → DNS → 找到 `workbench` 那条 A 记录：

- **删掉** `A → 101.200.131.44`
- **新建**：类型 `CNAME`，名称 `workbench`，目标 `69f29f36-6caa-4b3b-a84c-1daf4e997d6b.cfargotunnel.com`，代理状态**橙色云（已代理）**

> 隧道 ID 我从你截图里读的：`69f29f36-6caa-4b3b-a84c-1daf4e997d6b`。如果对不上，在 Tunnel 详情页右上角能直接复制。
> 有些版本的 CF 在「路由」那边加完会**自动帮你建好** CNAME，那样第二步就不用做了，刷新 DNS 页面看到橙云 CNAME 就对了。

改完等 1~2 分钟，访问 `https://workbench.lbuding.com`，应该直接落到设密码页。

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

## 七、以后怎么更新

改完代码 → 本机 `pnpm push` → GitHub Actions 自动构建新镜像（约 4 分钟，比第一次快，有缓存）→ 你在 NAS 上：

1. Docker → 项目 → `workbench` → **停止**
2. 镜像 → 本地镜像 → 删掉旧的 `workbench:latest`
3. 用新的 tar 重新导入（我会把新包发给你）
4. 项目 → **启动**

数据在 `/volume1/docker/workbench/data`，删镜像、重建容器都不会碰它。

> 想彻底不折腾：把 GitHub 仓库改成 public，GHCR 包也就能设 public，NAS 直接 `docker pull ghcr.io/lengbuding1991/personal-workbench:latest`，连导入都省了。代价是源码公开（`.gitignore` 已经把 `data/`、`screens/` 排除了，不会泄露数据）。要不要这么干你说一声。

---

## 备选方案：客户端里没有「导入镜像」

如果 UGOS 的 Docker 界面里找不到导入入口，两条路：

**A. 用 CF 隧道暴露一个临时端口**（不改 DNS，只在本机测）
不必，跳过。

**B. 让我在 GitHub Actions 里顺手产出一个「公开可拉」的镜像**
你把仓库设为 public（或授权我用另一个公开仓库），我改成推到 Docker Hub 或公开 GHCR，NAS 里填镜像名直接拉。

告诉我卡在哪一步，我按你的实际情况调。

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
| 停止信号 | tini 做 1 号进程，能干净收 SIGTERM |
