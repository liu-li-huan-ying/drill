#!/usr/bin/env bash
# 下载 ECDICT 主词典（MIT 许可）到 tools/cache/ecdict.csv
# 来源：https://github.com/skywind3000/ECDICT
# 数据管线离线跑一次即可，CSV 不进版本库（见 .gitignore 的 tools/cache/）。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$SCRIPT_DIR/cache"
URL="https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
OUT="$SCRIPT_DIR/cache/ecdict.csv"
echo "下载 ECDICT -> $OUT"
curl -L --retry 10 --retry-delay 3 --retry-all-errors -C - -o "$OUT" "$URL"
echo "完成: $(wc -c < "$OUT") bytes"
