#!/usr/bin/env bash
#
# 手动触发一次更新（和自动更新走完全相同的逻辑）。
#
# 用法：
#   sudo bash /opt/workbench/deploy/update.sh
#
set -uo pipefail
exec /bin/bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/auto-update.sh" --force
