#!/usr/bin/env bash
# ComfyUI를 끝내고 input/과 output/의 파일을 지운다(사진과 결과가 data/ 밖에 남지 않게).
set -u
R="$(cd "$(dirname "$0")/.." && pwd)"
C="$R/.local/ComfyUI"
PIDF="$R/.local/run/comfy.pid"

if [ -f "$PIDF" ]; then
  PID="$(cat "$PIDF")"
  # PID가 재사용됐을 수 있으니 ComfyUI의 main.py일 때만 끝낸다
  if ps -p "$PID" -o command= 2>/dev/null | grep -q "main.py --listen 127.0.0.1 --port 8188"; then
    kill "$PID" 2>/dev/null
    for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
    kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
    echo "comfy stopped (pid $PID)"
  fi
  rm -f "$PIDF"
fi
for d in "$C/input" "$C/output"; do
  [ -d "$d" ] && find "$d" -type f -delete
done
exit 0
