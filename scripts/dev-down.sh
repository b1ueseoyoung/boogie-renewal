#!/usr/bin/env bash
set -uo pipefail

for PORT in 3100 8000 8080; do
  PIDS="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  for PID in $PIDS; do
    CMDLINE="$(ps -p "$PID" -o command= 2>/dev/null || true)"
    if printf '%s' "$CMDLINE" | grep -qE 'uvicorn|DreamGoblinApplication|react-scripts'; then
      kill "$PID" 2>/dev/null || true
    else
      echo "dev-down.sh: 포트 $PORT 의 PID $PID 는 이 프로젝트의 프로세스가 아닙니다. 건드리지 않습니다 ($CMDLINE)" >&2
    fi
  done
done

exit 0
