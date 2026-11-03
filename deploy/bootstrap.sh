#!/usr/bin/env bash
#
# 服务器首次引导（把这段贴进阿里云网页终端就能跑）。
#
# 它做四件事，然后交给 deploy/setup.sh：
#   1. 装 curl / tar / ca-certificates
#   2. 写 GitHub token（自动更新要用它问 api.github.com）
#   3. 从 codeload 下快照解到 /opt/workbench（不走 github.com，那条路 TLS 会被掐）
#   4. 调用 setup.sh 装依赖、构建、起服务、配 nginx、申请证书
#
# 用法：
#   sudo DOMAIN=workbench.example.com GH_TOKEN=ghp_xxx bash bootstrap.sh
#
# 重复执行安全：已有 /opt/workbench 就只更新代码，数据目录不动。

set -euo pipefail

DOMAIN="${DOMAIN:?请指定 DOMAIN，例如 DOMAIN=workbench.example.com}"
GH_TOKEN="${GH_TOKEN:?请指定 GH_TOKEN（GitHub PAT）}"
REPO="${REPO:-lengbuding1991/personal-workbench}"
APP_DIR="${APP_DIR:-/opt/workbench}"
TOKEN_FILE="${TOKEN_FILE:-/etc/workbench/git-token}"
BRANCH="${BRANCH:-main}"

[ "$(id -u)" -eq 0 ] || { echo "请用 sudo / root 执行" >&2; exit 1; }

say() { printf "\n\033[1;36m== %s\033[0m\n" "$*"; }

say "1/4 装基础工具"
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y curl ca-certificates tar xz-utils >/dev/null
else
  (dnf install -y curl ca-certificates tar xz >/dev/null 2>&1) ||
  (yum install -y curl ca-certificates tar xz >/dev/null 2>&1)
fi

say "2/4 写 GitHub token"
mkdir -p "$(dirname "$TOKEN_FILE")"
printf '%s' "$GH_TOKEN" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
echo "  → ${TOKEN_FILE}"

say "3/4 下载代码快照"
SHA="$(curl -fsS --max-time 25 -H "Authorization: token ${GH_TOKEN}" \
        "https://api.github.com/repos/${REPO}/commits/${BRANCH}" \
      | sed -n 's/.*"sha": *"\([0-9a-f]\{40\}\)".*/\1/p' | head -1)"
if [ -z "$SHA" ]; then
  echo "  问不到 GitHub 最新提交（api.github.com 没通）" >&2
  exit 1
fi
echo "  最新提交 ${SHA:0:7}"

TARBALL="$(mktemp /tmp/wb-XXXXXX.tar.gz)"
DL=0
for i in 1 2 3; do
  if curl -fsSL --max-time 300 -H "Authorization: token ${GH_TOKEN}" \
       -o "$TARBALL" "https://codeload.github.com/${REPO}/tar.gz/${SHA}" && [ -s "$TARBALL" ]; then
    DL=1; break
  fi
  echo "  第 ${i} 次下载没通，5 秒后重试"
  sleep 5
done
[ "$DL" = 1 ] || { echo "  快照下载失败" >&2; exit 1; }

mkdir -p "$APP_DIR"
# data/ 单独留着：快照里本来就没有，这里再排除一次是双保险
tar -xzf "$TARBALL" -C "$APP_DIR" --strip-components=1 \
  --exclude='./data/*' --exclude='./data'
rm -f "$TARBALL"
printf '%s' "$SHA" > "$APP_DIR/.deployed-sha"
echo "  → ${APP_DIR}（${SHA:0:7}）"

say "4/4 交给 setup.sh"
cd "$APP_DIR"
exec bash deploy/setup.sh "$DOMAIN"
