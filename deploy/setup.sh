#!/usr/bin/env bash
#
# 个人工作台 —— 服务器一次性部署脚本
#
#   用法（在源码目录里执行）：
#       sudo bash deploy/setup.sh 你的域名
#
#   比如：sudo bash deploy/setup.sh workbench.example.com
#
# 它做七件事：
#   1. 装系统依赖（nginx / certbot / 编译工具）
#   2. 装 Node 24（走 npmmirror 镜像，国内不慢）
#   3. 建普通用户 workbench，应用不用 root 跑
#   4. 把代码放进 /opt/workbench，装依赖、构建
#   5. 建数据目录（data/ 不在仓库里，永远不会被覆盖）
#   6. 注册 systemd 服务 + 自动更新定时器 + nginx 站点
#   7. 申请 HTTPS 证书（域名解析对了才会成功）
#
# 重复执行是安全的：已装的东西跳过，数据目录不动。

set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo "用法: sudo bash deploy/setup.sh 你的域名" >&2
  exit 1
fi

APP_USER=workbench
APP_DIR=/opt/workbench
PORT=3200
NODE_MAJOR=24
NODE_VERSION=24.22.1
TOKEN_FILE=/etc/workbench/git-token
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m!! %s\033[0m\n" "$*"; }
ok() { printf "\033[1;32m ✓ %s\033[0m\n" "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "请用 sudo / root 执行" >&2; exit 1; }

# ---------- 1. 系统依赖 ----------
say "1/7 安装系统依赖"
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl ca-certificates git tar xz-utils rsync g++ make python3 sqlite3 nginx
  apt-get install -y certbot python3-certbot-nginx 2>/dev/null || warn "certbot 没装上，HTTPS 那步会跳过"
  systemctl enable --now nginx
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl ca-certificates git tar xz rsync gcc-c++ make python3 nginx sqlite3
  dnf install -y certbot python3-certbot-nginx 2>/dev/null || warn "certbot 没装上，HTTPS 那步会跳过"
  systemctl enable --now nginx
else
  yum install -y curl ca-certificates git tar xz rsync gcc-c++ make python3 nginx sqlite3
  yum install -y certbot python3-certbot-nginx 2>/dev/null || warn "certbot 没装上，HTTPS 那步会跳过"
  systemctl enable --now nginx
fi
ok "系统依赖就绪"

# ---------- 2. Node ----------
say "2/7 安装 Node ${NODE_MAJOR}"
NODE_BIN=/usr/local/bin/node
if ! "$NODE_BIN" -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  case "$(uname -m)" in
    x86_64) ARCH=x64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    *) echo "不认识的架构 $(uname -m)" >&2; exit 1 ;;
  esac
  # 用固定版本号而不是 latest-XX：latest 目录在镜像上是重定向，
  # 而 SHASUMS 里出现的版本偶尔比 tarball 先上架，固定版本最稳。
  BASE="https://cdn.npmmirror.com/binaries/node/v${NODE_VERSION}"
  FILE="node-v${NODE_VERSION}-linux-${ARCH}.tar.xz"
  echo "  下载 $FILE"
  curl -fL --retry 3 --max-time 600 "$BASE/$FILE" -o /tmp/node.tar.xz
  rm -rf "/usr/local/lib/node-${NODE_MAJOR}"
  mkdir -p "/usr/local/lib/node-${NODE_MAJOR}"
  tar -xJf /tmp/node.tar.xz -C "/usr/local/lib/node-${NODE_MAJOR}" --strip-components=1
  ln -sf "/usr/local/lib/node-${NODE_MAJOR}/bin/node" /usr/local/bin/node
  ln -sf "/usr/local/lib/node-${NODE_MAJOR}/bin/npm"  /usr/local/bin/npm
  ln -sf "/usr/local/lib/node-${NODE_MAJOR}/bin/npx"  /usr/local/bin/npx
  rm -f /tmp/node.tar.xz
fi
"$NODE_BIN" -v
ok "Node $(command -v node) $("$NODE_BIN" -v)"

# tarball 装的 node，npm -g 的 bin 会落在 node 自己的目录里，先把 prefix 拨到 /usr/local
npm config set prefix /usr/local
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@12.15.0 --registry=https://registry.npmmirror.com
fi
command -v pnpm >/dev/null 2>&1 || { echo "pnpm 不可用，停在这里" >&2; exit 1; }
ok "pnpm $(pnpm -v)"

# ---------- 3. 运行用户 ----------
say "3/7 准备运行用户 ${APP_USER}"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi
ok "用户 ${APP_USER} 就绪"

# ---------- 4. 代码 + 依赖 + 构建 ----------
say "4/7 部署代码到 ${APP_DIR}"
mkdir -p "$APP_DIR"
if [ "$SRC_DIR" = "$APP_DIR" ]; then
  # 首次安装走的是「从 codeload 解压到 /opt/workbench 再跑本脚本」，
  # 源码已经在位，此时绝不能再 rsync 一遍（--delete 会把自己删掉）。
  echo "  源码已在 ${APP_DIR}，跳过复制"
else
  # 只同步源码：node_modules / .next / 数据库 / git 历史都不带
  rsync -a --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude .git \
    --exclude screens \
    --exclude prototypes/screens \
    --exclude 'data/*.db*' \
    --exclude 'data/backups' \
    "$SRC_DIR"/ "$APP_DIR"/
fi

mkdir -p "$APP_DIR/data/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# pnpm 的全局 store 要写在用户家目录里，HOME 不对会报 EACCES
chmod 755 "$APP_DIR"

echo "  装依赖（首次要一两分钟）"
su - "$APP_USER" -c "cd '$APP_DIR' && pnpm install --frozen-lockfile --registry=https://registry.npmmirror.com"

# 小内存机器（1~2G）没 swap 时，next build 很容易被 OOM killer 杀掉（exit 137）。
# 先补一块 swap，成本几乎为零，但能救回这类失败。
if [ -z "$(swapon --show 2>/dev/null)" ] && [ "$(free -m 2>/dev/null | awk '/Mem:/{print $2}')" -lt 2500 ] 2>/dev/null; then
  echo "  内存偏小且没有 swap，先补 1G swap"
  (fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none) &&
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile >/dev/null &&
  grep -q '^/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "  构建（第一次大概 30~60 秒）"
# 记准这次部署的是哪个提交，自动更新靠它判断要不要动
# 注意：文件不存在时不能直接 `< 文件`，重定向由 shell 处理，2>/dev/null 拦不住，
# 会打印一行 "No such file or directory" 让人以为出错了。所以先判断存在。
SHA_NOW=""
if [ -f "$APP_DIR/.deployed-sha" ]; then
  SHA_NOW="$(tr -d '\r\n' < "$APP_DIR/.deployed-sha" 2>/dev/null || true)"
fi
if [ -z "$SHA_NOW" ] && [ -f "$TOKEN_FILE" ]; then
  SHA_NOW="$(curl -fsS --max-time 20 -H "Authorization: token $(tr -d '\r\n' < "$TOKEN_FILE")" \
    "https://api.github.com/repos/lengbuding1991/personal-workbench/commits/main" 2>/dev/null \
    | sed -n 's/.*"sha": *"\([0-9a-f]\{40\}\)".*/\1/p' | head -1 || true)"
fi
SHA_NOW="${SHA_NOW:-setup}"
printf '%s' "$SHA_NOW" > "$APP_DIR/.deployed-sha"
chown "$APP_USER:$APP_USER" "$APP_DIR/.deployed-sha"
# 类型检查单独跑：next.config.ts 里已经把 build 期间的类型检查关掉，
# 因为那一步会在 webpack 还在占内存时再拉一个 tsc，2G 机器上必被 OOM 杀。
# 拆开跑峰值内存只取较大者，而校验强度没变 —— 这里失败就不往下走。
echo "  类型检查"
if su - "$APP_USER" -c "cd '$APP_DIR' && NODE_OPTIONS='--max-old-space-size=1024' pnpm typecheck"; then
  ok "类型检查通过"
else
  warn "类型检查没通过，先不构建。修完再跑 sudo bash ${APP_DIR}/deploy/setup.sh ${DOMAIN}"
  exit 1
fi

echo "  构建（第一次大概 30~60 秒）"
# 构建阶段已经没有 tsc 并行，堆上限给 1024 就够，再多反而更容易触发 OOM
su - "$APP_USER" -c "cd '$APP_DIR' && NODE_OPTIONS='--max-old-space-size=1024' WORKBENCH_SHA='$SHA_NOW' pnpm build"
ok "构建完成"

# ---------- 5. 数据目录 ----------
say "5/7 数据目录"
if [ -f "$APP_DIR/data/workbench.db" ]; then
  echo "  已有数据库，跳过（不会覆盖你的数据）"
else
  # 首次启动时 lib/db.ts 会自己建库建表并灌 7 条示例，这里不预置任何东西
  echo "  将新建空库（首次打开会有示例数据，可在设置页清空）"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR/data"
ok "数据目录 ${APP_DIR}/data"

# ---------- 6. 服务 + 定时器 + 反代 ----------
say "6/7 注册服务与反向代理"

mkdir -p /etc/workbench
if [ ! -f "$TOKEN_FILE" ]; then
  warn "没找到 ${TOKEN_FILE}（自动更新会问不到版本）"
  warn "补一条即可：echo '你的_github_token' > ${TOKEN_FILE} && chmod 600 ${TOKEN_FILE}"
fi
[ -f "$TOKEN_FILE" ] && chmod 600 "$TOKEN_FILE"

sed -e "s|__APP_USER__|$APP_USER|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    -e "s|__NODE_BIN__|$NODE_BIN|g" \
    -e "s|__PORT__|$PORT|g" \
    -e "s|__SHA__|${SHA_NOW:-setup}|g" \
    "$APP_DIR/deploy/workbench.service" > /etc/systemd/system/workbench.service

systemctl daemon-reload || true
systemctl enable workbench >/dev/null
systemctl restart workbench

chmod +x "$APP_DIR"/deploy/*.sh 2>/dev/null || true
for u in workbench-update.service workbench-update.timer; do
  [ -f "$APP_DIR/deploy/$u" ] || continue
  sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__NODE_BIN__|$NODE_BIN|g" \
      "$APP_DIR/deploy/$u" > "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable --now workbench-update.timer >/dev/null 2>&1 || \
  warn "workbench-update.timer 没装上，代码不会自动更新"
# 提醒：别和发货库存的 update-check.timer 混了，那是另一套
systemctl list-timers --all 2>/dev/null | grep -E "workbench|deng-stock" || true

CONF=/etc/nginx/conf.d/workbench.conf
[ -d /etc/nginx/sites-available ] && CONF=/etc/nginx/sites-available/workbench.conf
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__PORT__|$PORT|g" \
    "$APP_DIR/deploy/nginx.conf.template" > "$CONF"
[ -d /etc/nginx/sites-enabled ] && ln -sf "$CONF" /etc/nginx/sites-enabled/workbench.conf

nginx -t
systemctl reload nginx
ok "nginx 已指向 ${DOMAIN} → 127.0.0.1:${PORT}"

sleep 3
if curl -fsS -o /dev/null "http://127.0.0.1:${PORT}/api/health"; then
  ok "应用在跑：http://127.0.0.1:${PORT}/api/health"
else
  warn "应用没起来，看日志：journalctl -u workbench -n 60 --no-pager"
fi

# ---------- 7. HTTPS ----------
say "7/7 HTTPS"
SERVER_IP="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null || echo '')"
# 有的精简镜像没有 getent，退回 python / dig
resolve_domain() {
  if command -v getent >/dev/null 2>&1; then
    getent hosts "$1" | awk '{print $1}' | head -1
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import socket,sys;print(socket.gethostbyname(sys.argv[1]))" "$1" 2>/dev/null || true
  elif command -v dig >/dev/null 2>&1; then
    dig +short "$1" | head -1
  fi
}
RESOLVED="$(resolve_domain "$DOMAIN" || true)"
if [ -z "$RESOLVED" ]; then
  warn "域名 ${DOMAIN} 还没有解析记录，跳过 HTTPS"
  warn "去域名控制台加一条 A 记录指向 ${SERVER_IP:-这台机器的公网 IP}，然后重跑："
  warn "  sudo certbot --nginx -d ${DOMAIN}"
elif [ -n "$SERVER_IP" ] && [ "$RESOLVED" != "$SERVER_IP" ]; then
  warn "域名解析到 ${RESOLVED}，但这台机器是 ${SERVER_IP}，不一致，跳过 HTTPS"
elif command -v certbot >/dev/null 2>&1; then
  echo "  正在申请证书（需要 80 端口能从公网访问）"
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
       --register-unsafely-without-email --redirect >/tmp/certbot.log 2>&1; then
    ok "HTTPS 已开启：https://${DOMAIN}"
    # 上了 https 才允许 cookie 带 Secure。反过来，如果证书没申请下来，
    # 强行开 Secure 会让浏览器在 http 下直接丢掉 cookie —— 登录看似成功却一直跳回登录页。
    sed -i 's|^Environment=WB_SECURE_COOKIE=.*|Environment=WB_SECURE_COOKIE=1|' /etc/systemd/system/workbench.service || true
    systemctl daemon-reload
    systemctl restart workbench
  else
    warn "证书没申请下来，看 /tmp/certbot.log"
    warn "常见原因：安全组没放行 80、域名还没解析好"
    # 没有 https 就别强制 Secure cookie，否则登录会一直失败
    sed -i 's|^Environment=WB_SECURE_COOKIE=.*|Environment=WB_SECURE_COOKIE=0|' /etc/systemd/system/workbench.service || true
    systemctl daemon-reload
    systemctl restart workbench
  fi
else
  warn "没装 certbot，手动申请：certbot --nginx -d ${DOMAIN}"
  sed -i 's|^Environment=WB_SECURE_COOKIE=.*|Environment=WB_SECURE_COOKIE=0|' /etc/systemd/system/workbench.service || true
  systemctl daemon-reload
  systemctl restart workbench
fi

echo
say "完成"
echo "  打开：https://${DOMAIN}   （没上 HTTPS 就用 http://${DOMAIN}）"
echo "  首次打开会让你设置访问密码。"
echo
echo "  以后改了代码："
echo "    本机  pnpm push          # 推到 GitHub"
echo "    服务器自动 5 分钟内更新，或手动： sudo bash ${APP_DIR}/deploy/update.sh"
echo
echo "  常用命令："
echo "    日志    journalctl -u workbench -f"
echo "    更新日志 tail -f /var/log/workbench-update.log"
echo "    重启    systemctl restart workbench"
echo "    数据    ${APP_DIR}/data/workbench.db"
echo
