#!/usr/bin/env bash
#
# 自动更新：GitHub 的 main 有新提交 → 下载快照 → 装依赖 → 构建 → 重启。
# 由 systemd timer 每 5 分钟触发一次（见 update-check.timer）。
#
# 为什么不用 git pull：
#   这台阿里云机器到 github.com:443 的 TLS 会被中途掐断（GnuTLS recv error -110），
#   但 api.github.com 和 codeload.github.com 是通的。
#   所以走「问 API 要最新 sha → 从 codeload 下 tarball → 解压覆盖」，全程不碰 github.com。
#
# 安全边界：
#   · 构建失败   → 回滚到上一版并重启，线上不会挂
#   · 健康检查失败 → 同上
#   · 网络/token 出问题 → 记日志直接跳过，不动正在跑的服务
#   · data/ 永不被覆盖（tarball 里也排除掉，双保险）
#
# 日志：/var/log/workbench-update.log
#
set -uo pipefail

APP_DIR="${APP_DIR:-/opt/workbench}"
REPO="${REPO:-lengbuding1991/personal-workbench}"
TOKEN_FILE="${TOKEN_FILE:-/etc/workbench/git-token}"
SERVICE="${SERVICE:-workbench}"
PORT="${PORT:-3200}"
LOG="${LOG:-/var/log/workbench-update.log}"
APP_USER="${APP_USER:-workbench}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

# 结果写进 .update-status.json，页面上的「数据」区会读它显示
stat() {
  local result="$1" msg="$2"
  printf '{"at":"%s","result":"%s","message":"%s"}\n' \
    "$(date -Iseconds)" "$result" "${msg//\"/}" > "$APP_DIR/.update-status.json" 2>/dev/null || true
  chown "$APP_USER:$APP_USER" "$APP_DIR/.update-status.json" 2>/dev/null || true
}

cd "$APP_DIR" || exit 1

# ---- 只允许一个实例在跑 ------------------------------------------------
# timer 每 5 分钟一次，而一次构建可能 2~4 分钟；手动 update.sh 再叠一层时，
# 两个 pnpm build 同时抢内存 = 直接把 2G 机器打到疯狂 swap，
# 表现就是「服务器死机了」（其实是内核在换页，SSH 都进不去）。
# flock 拿不到锁就直接退出，等下一轮。
LOCK="/var/lock/workbench-update.lock"
exec 9>"$LOCK" || exit 1
if ! flock -n 9; then
  log "上一轮更新还没结束，本轮跳过"
  exit 0
fi

TOKEN=""
[ -f "$TOKEN_FILE" ] && TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"
AUTH=()
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: token ${TOKEN}")

# ---- 内存预检：不够就先不构建 ------------------------------------------
# 这台机器还要跑发货库存（deng-stock），两个 app 常驻就已经吃掉一半内存。
# 构建前先看 MemAvailable，低于阈值就别硬上，等下一轮（数据不会丢，
# 正在跑的服务也不受影响），总比把机器打到换页强。
mem_available_mb() {
  awk '/^MemAvailable:/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 9999
}
MIN_FREE_MB="${MIN_FREE_MB:-600}"

# 没 swap 的话补一块：构建峰值会短时间超过物理内存，有 swap 只是慢，没 swap 直接被杀。
ensure_swap() {
  [ -n "$(swapon --show 2>/dev/null)" ] && return 0
  local total
  total="$(awk '/^MemTotal:/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 9999)"
  [ "$total" -ge 3500 ] && return 0
  log "没有 swap，补 1G（防止构建被 OOM 杀）"
  (fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none) &&
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile >/dev/null &&
  { grep -q '^/swapfile' /etc/fstab 2>/dev/null || echo '/swapfile none swap sw 0 0' >> /etc/fstab; } || \
    log "⚠️ swap 没补上，继续尝试构建"
}

low_memory() {
  local avail
  avail="$(mem_available_mb)"
  [ "$avail" -lt "$MIN_FREE_MB" ] && { echo "$avail"; return 0; }
  return 1
}

# 构建命令统一走这里：降优先级 + 限堆，别和 nginx / 别的 app 抢 CPU 和内存。
build_cmd() {
  local sha="$1"
  echo "cd '$APP_DIR' && NODE_OPTIONS='--max-old-space-size=1024' WORKBENCH_SHA='$sha' nice -n 10 pnpm build"
}

# ---- 现在跑的是哪一版 --------------------------------------------------
# 解压覆盖之后 git HEAD 不会前进，所以用 .deployed-sha 记准
CUR=""
[ -f "$APP_DIR/.deployed-sha" ] && CUR="$(tr -d '\r\n' < "$APP_DIR/.deployed-sha")"

# ---- 远端最新是哪个 ----------------------------------------------------
NEW="$(curl -fsS --max-time 25 "${AUTH[@]}" \
        "https://api.github.com/repos/${REPO}/commits/main" 2>>"$LOG" \
      | sed -n 's/.*"sha": *"\([0-9a-f]\{40\}\)".*/\1/p' | head -1)"

if [ -z "$NEW" ]; then
  log "❌ 问不到 GitHub 最新版本（api.github.com 这次没通），跳过；5 分钟后再试"
  stat error "问不到 GitHub 最新版本（网络没通）"
  exit 0
fi

if [ "$NEW" = "$CUR" ] && [ "$FORCE" = 0 ]; then
  stat ok "已是最新"
  exit 0
fi

OLD="$CUR"
log "发现新版本 ${CUR:0:7} → ${NEW:0:7}，开始更新"

# ---- 下载快照 ----------------------------------------------------------
TARBALL="$(mktemp /tmp/workbench-XXXXXX.tar.gz)"
DL_OK=0
for i in 1 2 3; do
  if curl -fsSL --max-time 300 "${AUTH[@]}" \
       -o "$TARBALL" "https://codeload.github.com/${REPO}/tar.gz/${NEW}" 2>>"$LOG" \
     && [ -s "$TARBALL" ]; then
    DL_OK=1; break
  fi
  log "第 ${i} 次下载没通，5 秒后重试"
  sleep 5
done
if [ "$DL_OK" != 1 ]; then
  rm -f "$TARBALL"
  log "❌ 快照下载失败，本次跳过，线上服务不受影响；5 分钟后再试"
  stat error "快照下载失败"
  exit 0
fi

# 回滚：重新下上一版快照覆盖回去并重启。
# 线上没有 .git（代码是解压来的，不是 clone 的），所以不能用 git reset。
rollback() {
  log "❌ $1 —— 尝试回滚到 ${OLD:0:7}"
  stat error "$1（回滚到 ${OLD:0:7}）"
  if [ -n "$OLD" ]; then
    local RB
    RB="$(mktemp /tmp/workbench-rb-XXXXXX.tar.gz)"
    if curl -fsSL --max-time 300 "${AUTH[@]}" -o "$RB" \
         "https://codeload.github.com/${REPO}/tar.gz/${OLD}" 2>>"$LOG" && [ -s "$RB" ]; then
      tar -xzf "$RB" -C "$APP_DIR" --strip-components=1 \
        --exclude='*/data' --exclude='*/data/*' \
        --exclude='*/.next' --exclude='*/node_modules' >>"$LOG" 2>&1
      rm -f "$RB"
      chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null
      sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile" >>"$LOG" 2>&1
      sudo -u "$APP_USER" -H bash -lc "$(build_cmd "$OLD")" >>"$LOG" 2>&1
      printf '%s' "$OLD" > "$APP_DIR/.deployed-sha"
      systemctl restart "$SERVICE"
      log "已回滚，服务恢复到 ${OLD:0:7}"
    else
      rm -f "$RB"
      log "❌ 回滚包也没下下来，服务保持现状（上一版代码已被覆盖一部分，请人工介入）"
    fi
  else
    log "没有可回滚的旧版本（首次部署？），服务保持现状"
  fi
  exit 1
}

# ---- 覆盖代码 ----------------------------------------------------------
# 只覆盖源码目录；data/、node_modules/、.next/ 都不在 tarball 里/被排除。
# 注意：删掉的文件不会跟着消失（快照覆盖的固有缺点），但不会把线上 data/ 打掉。
tar -xzf "$TARBALL" -C "$APP_DIR" --strip-components=1 \
  --exclude='*/data' --exclude='*/data/*' \
  --exclude='*/.next' --exclude='*/node_modules' >>"$LOG" 2>&1 \
  || rollback "解压失败"
rm -f "$TARBALL"
printf '%s' "$NEW" > "$APP_DIR/.deployed-sha"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" 2>/dev/null

sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && pnpm install --frozen-lockfile" >>"$LOG" 2>&1 \
  || rollback "装依赖失败"

# 类型检查与构建分开跑：合在一起时 tsc 会和 webpack 抢内存，2G 机器上必被 OOM 杀
# （exit 137 / Killed）。原因与取舍见 next.config.ts 的注释。
ensure_swap

if AVAIL="$(low_memory)"; then
  log "⚠️ 可用内存只有 ${AVAIL}MB（低于 ${MIN_FREE_MB}MB），这次先不构建，等下一轮；线上服务没动"
  stat error "内存不足（可用 ${AVAIL}MB），下轮再试"
  exit 0
fi

sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && NODE_OPTIONS='--max-old-space-size=1024' nice -n 10 pnpm typecheck" >>"$LOG" 2>&1 \
  || rollback "类型检查失败"

sudo -u "$APP_USER" -H bash -lc "$(build_cmd "$NEW")" >>"$LOG" 2>&1 \
  || rollback "构建失败"

# 保证数据目录还在（首次部署时由 setup.sh 建好）
mkdir -p "$APP_DIR/data" "$APP_DIR/data/backups" 2>/dev/null || true
chown -R "$APP_USER:$APP_USER" "$APP_DIR/data" 2>/dev/null || true

systemctl restart "$SERVICE"

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    log "✅ 更新完成，现在是 ${NEW:0:7}"
    stat changed "已更新到 ${NEW:0:7}"
    exit 0
  fi
  sleep 1
done

rollback "重启后健康检查没通过"
