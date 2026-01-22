#!/usr/bin/env bash
# nightly-push.sh - Nightly DevGate metrics push (for cron)
#
# 添加到 crontab:
#   0 2 * * * /home/xx/dev/zenithjoy-engine/scripts/devgate/nightly-push.sh >> /var/log/devgate-nightly.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo "$LOG_PREFIX Starting DevGate nightly push..."

# 加载环境变量
source ~/.credentials/devgate.env

# 执行推送
cd "$SCRIPT_DIR/../.."
bash scripts/devgate/push-metrics.sh

echo "$LOG_PREFIX DevGate nightly push completed."
