#!/bin/bash

PHOTO_DIR="${PHOTO_DIR:-data/photos}"
CODEX_BIN="${CODEX_BIN:-codex}"
CODEX_HOME_DIR="${CODEX_HOME_DIR:-$HOME/.codex}"

photo_found=0
if [[ ! -d "$PHOTO_DIR" ]]; then
  echo "data/photos에 사진을 넣어 주세요"
  exit 10
fi

for photo in "$PHOTO_DIR"/*; do
  [[ -f "$photo" ]] || continue
  mime_type=$(file --mime-type "$photo" 2>/dev/null | cut -d: -f2 | xargs)
  if [[ "$mime_type" != "image/jpeg" && "$mime_type" != "image/png" ]]; then
    continue
  fi
  sips_output=$(sips -g pixelWidth -g pixelHeight "$photo" 2>/dev/null || true)
  if [[ -z "$sips_output" ]]; then
    continue
  fi
  width=$(echo "$sips_output" | grep "pixelWidth" | awk '{print $2}')
  height=$(echo "$sips_output" | grep "pixelHeight" | awk '{print $2}')
  if [[ -z "$width" || -z "$height" ]]; then
    continue
  fi
  short_side=$((width < height ? width : height))
  if [[ $short_side -ge 512 ]]; then
    photo_found=1
    break
  fi
done

if [[ $photo_found -eq 0 ]]; then
  echo "data/photos에 사진을 넣어 주세요"
  exit 10
fi

login_status=$("$CODEX_BIN" login status 2>&1 || true)
if ! echo "$login_status" | grep -iq "ChatGPT"; then
  exit 11
fi

features_list=$("$CODEX_BIN" features list 2>&1 || true)
image_gen_line=$(echo "$features_list" | grep -i "image_generation" || true)
if ! echo "$image_gen_line" | grep -iq "true"; then
  exit 12
fi

sessions_dir="$CODEX_HOME_DIR/sessions"
used_percent=""
resets_at=""

if [[ -d "$sessions_dir" ]]; then
  latest=$(find "$sessions_dir" -type f -name 'rollout-*.jsonl' -exec grep -h '"used_percent"' {} + 2>/dev/null | LC_ALL=C sort | tail -n 1)
  
  if [[ -n "$latest" ]]; then
    used_percent=$(printf '%s\n' "$latest" | grep -o '"used_percent"[[:space:]]*:[[:space:]]*[0-9.]*' | head -n 1 | sed 's/.*:[[:space:]]*//')
    resets_at=$(printf '%s\n' "$latest" | grep -o '"resets_at"[[:space:]]*:[[:space:]]*[0-9]*' | head -n 1 | sed 's/.*:[[:space:]]*//')
  fi
fi

if [[ -n "$used_percent" ]]; then
  echo "used_percent: $used_percent"
else
  echo "used_percent: unknown"
fi

if [[ -n "$resets_at" ]]; then
  if [[ "$resets_at" =~ ^[0-9]+$ ]]; then
    resets_at_kst=$(TZ=Asia/Seoul date -r "$resets_at" "+%Y-%m-%d %H:%M %Z" 2>/dev/null || echo "$resets_at")
    echo "resets_at: $resets_at_kst"
  fi
fi

exit 0
