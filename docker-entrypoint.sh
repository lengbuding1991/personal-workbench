#!/bin/sh
#
# 容器启动脚本。
#
# 唯一的职责：把挂进来的 /data 目录属主修对，然后降权运行。
#
# 为什么需要：
#   NAS 的图形界面（UGOS Pro「项目」页面）创建宿主机目录时是 root 所有，
#   而镜像里应用以 uid 1001（nextjs）运行。不修属主，首次建库就会
#   EACCES 起不来，而用户又不想为了 chown 去开 SSH。
#   所以容器先以 root 启动、改属主、再 su-exec 降到 nextjs 跑应用本身。
#
set -e

if [ -d /data ]; then
  # 忽略失败：有些文件系统（如只读挂载）不允许改，真正的错误留给应用报
  chown -R nextjs:nodejs /data 2>/dev/null || true
fi

exec su-exec nextjs:nodejs "$@"
