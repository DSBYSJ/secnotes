#!/usr/bin/env bash
# SECNOTES 本地预览
set -eu
PORT="${1:-8787}"
cd "$(dirname "$0")"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "需要 python3 或 python，未找到。" >&2
  exit 1
fi

URL="http://127.0.0.1:${PORT}/"
echo "SECNOTES → ${URL}"
echo "Ctrl+C 停止服务"

(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true; fi
  if command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true; fi
) &

exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
