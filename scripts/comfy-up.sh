#!/usr/bin/env bash
# ComfyUI를 127.0.0.1:8188에 띄운다. 이미 떠 있으면 그대로 둔다.
set -u
R="$(cd "$(dirname "$0")/.." && pwd)"
C="$R/.local/ComfyUI"
PIDF="$R/.local/run/comfy.pid"
URL="http://127.0.0.1:8188"
mkdir -p "$R/.local/run"

alive() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

if alive && curl -sf "$URL/system_stats" >/dev/null; then
  echo "comfy already up (pid $(cat "$PIDF"))"; exit 0
fi
if ! alive && curl -sf "$URL/system_stats" >/dev/null; then
  echo "port 8188 is used by a process this script did not start" >&2; exit 1
fi
[ -x "$C/.venv/bin/python" ] || { echo "run scripts/comfy-setup.sh first" >&2; exit 1; }

if ! alive; then # 죽은 PID 파일은 덮어쓴다
  cd "$C" || exit 1
  nohup .venv/bin/python main.py --listen 127.0.0.1 --port 8188 > comfy.log 2>&1 < /dev/null &
  echo $! > "$PIDF"
fi
for _ in $(seq 1 "${COMFY_UP_TIMEOUT_S:-180}"); do
  curl -sf "$URL/system_stats" >/dev/null && { echo "comfy up (pid $(cat "$PIDF"))"; exit 0; }
  alive || { echo "comfy exited during start, see $C/comfy.log" >&2; rm -f "$PIDF"; exit 1; }
  sleep 1
done
echo "comfy did not answer in time, see $C/comfy.log" >&2
exit 1
