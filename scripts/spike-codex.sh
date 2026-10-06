#!/bin/bash
# codex 실제 호출 스파이크(계획 할 일 10). 실제 구독 한도를 쓴다.
#   사용: bash scripts/spike-codex.sh [s1] [s2] [s3] [s1a] [s4]   (인자가 없으면 모든 단계)
#   s1  글(--output-schema, 실패하면 스키마 없이 한 번)            -> CODEX_USE_OUTPUT_SCHEMA
#   s2  사진으로 기준 캐릭터(구성 A, 실패하면 구성 B 한 번)        -> CODEX_MODEL, CODEX_IGNORE_USER_CONFIG
#   s3  캐릭터 참조 장면(조건 front), 채택한 구성으로
#   s1a s1과 같은 글 작업을 채택한 구성으로
#   s4  특징 문장(charLook) 글 작업: 캐릭터와 사진을 함께 넣는다. 이미지를 만들지 않는다.
# 이미지 생성은 s2, s3뿐이고 한 번 실행에 상한 4회다. 결과는 data/lab/spike/, 표는 docs/spike-codex.md(행 파일로 다시 만든다).
# 모델의 최종 메시지는 신뢰하지 않는 글이다: jq로 JSON 데이터로만 읽고 실행하지 않는다.
# s4의 charLook은 실제 사람의 외모 묘사라 data/lab/spike/s4.json에만 남기고 문서에는 글자 수만 쓴다.
# 종료 코드: 0 성공, 2 모르는 단계, 10 사진 없음, 21 S1 실패, 22 S2 구성 미확정, 23 S3 실패, 24 이미지 호출 상한,
#            25 채택한 구성의 글 호출 실패, 127 codex 없음.
set -u
set -m  # 백그라운드 작업이 자기 프로세스 그룹을 갖게 한다(시간 초과 때 그룹째 종료)

R="$(cd "$(dirname "$0")/.." && pwd)"
CODEX_BIN="${CODEX_BIN:-codex}"
CODEX_HOME_DIR="${CODEX_HOME_DIR:-$HOME/.codex}"
SPIKE_DIR="${SPIKE_DIR:-$R/data/lab/spike}"
ENV_FILE="${ENV_FILE:-$R/backend-fastAPI/.env}"
DOC_FILE="${DOC_FILE:-$R/docs/spike-codex.md}"
PHOTO_DIR="${PHOTO_DIR:-$R/data/photos}"
TEXT_TIMEOUT_S="${TEXT_TIMEOUT_S:-120}"
IMAGE_TIMEOUT_S="${IMAGE_TIMEOUT_S:-300}"
FALLBACK_REF="$R/.local/frontend-main-backup/public/sticker_tokki.png"
ROWS_DIR="$SPIKE_DIR/rows"
MAX_IMAGE_CALLS=4
PNG_SIG=89504e470d0a1a0a

if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
  echo "codex를 찾을 수 없습니다: $CODEX_BIN" >&2
  exit 127
fi

STEPS="${*:-s1 s2 s3 s1a s4}"
for step in $STEPS; do
  case "$step" in
    s1 | s2 | s3 | s1a | s4) ;;
    *) echo "알 수 없는 단계: $step (s1 s2 s3 s1a s4 중에서 고릅니다)" >&2; exit 2 ;;
  esac
done
want() { case " $STEPS " in *" $1 "*) return 0 ;; esac; return 1; }

PHOTO=$(find "$PHOTO_DIR" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) 2>/dev/null | sort | head -n 1)
if [ -z "$PHOTO" ]; then
  echo "data/photos에 사진을 넣어 주세요" >&2
  exit 10
fi

mkdir -p "$ROWS_DIR" "$(dirname "$DOC_FILE")"

CUR_PID=""
trap '[ -n "$CUR_PID" ] && kill -KILL -- "-$CUR_PID" 2>/dev/null' EXIT

now() { perl -MTime::HiRes=time -e 'printf "%.3f", time'; }

# 가장 최근 rollout 줄의 used_percent(줄이 timestamp로 시작하므로 정렬의 마지막이 최신)
latest_used_percent() {
  find "$CODEX_HOME_DIR/sessions" -type f -name 'rollout-*.jsonl' -exec grep -h '"used_percent"' {} + 2>/dev/null \
    | LC_ALL=C sort | tail -n 1 | grep -o '"used_percent"[[:space:]]*:[[:space:]]*[0-9.]*' | head -n 1 | sed 's/.*:[[:space:]]*//'
}

thread_used_percent() {
  [ -n "$1" ] || return 0
  find "$CODEX_HOME_DIR/sessions" -type f -name "rollout-*-$1.jsonl" -exec grep -ho '"used_percent"[[:space:]]*:[[:space:]]*[0-9.]*' {} + 2>/dev/null \
    | tail -n 1 | sed 's/.*:[[:space:]]*//'
}

# 최종 메시지에서 코드 펜스 줄만 걷어 낸다(스키마 없이 받은 답 대비)
message_json() { [ -f "$LAST_MSG" ] && grep -v '^[[:space:]]*```' "$LAST_MSG"; }

env_get() { [ -f "$ENV_FILE" ] && grep "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2-; }

set_env() { # <이름> <값>: 그 이름의 줄만 바꾸고 나머지는 그대로 둔다
  local tmp="$ENV_FILE.tmp.$$"
  { [ -f "$ENV_FILE" ] && grep -v "^$1=" "$ENV_FILE"; echo "$1=$2"; } > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

config_label() {
  if [ "$(env_get CODEX_MODEL)" = gpt-6-luna ] && [ "$(env_get CODEX_IGNORE_USER_CONFIG)" = 1 ]; then echo A; else echo B; fi
}

# run_codex <라벨> <제한 초> <프롬프트> [추가 옵션...]
# 결과: EXIT_CODE, TIMED_OUT, SECS, THREAD_ID, USAGE, PCT_BEFORE, PCT_AFTER, LAST_MSG
run_codex() {
  local label=$1 limit=$2 prompt=$3
  shift 3
  local events="$SPIKE_DIR/$label.events.jsonl" err="$SPIKE_DIR/$label.stderr.txt" waited=0 t0
  LAST_MSG="$SPIKE_DIR/$label.last-message.txt"
  rm -f "$events" "$err" "$LAST_MSG"
  TIMED_OUT=0
  PCT_BEFORE=$(latest_used_percent)
  t0=$(now)
  # -i는 값을 여러 개 받으므로 프롬프트는 -o <파일> 뒤에 둔다
  "$CODEX_BIN" exec --json --skip-git-repo-check -s read-only -C "$SPIKE_DIR" "$@" -o "$LAST_MSG" "$prompt" \
    < /dev/null > "$events" 2> "$err" &
  CUR_PID=$!
  while kill -0 "$CUR_PID" 2>/dev/null; do
    if [ "$waited" -ge "$limit" ]; then
      TIMED_OUT=1
      kill -TERM -- "-$CUR_PID" 2>/dev/null
      sleep 2
      kill -KILL -- "-$CUR_PID" 2>/dev/null
      break
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "$CUR_PID" 2>/dev/null
  EXIT_CODE=$?
  CUR_PID=""
  SECS=$(perl -e 'printf "%.1f", $ARGV[1] - $ARGV[0]' "$t0" "$(now)")
  THREAD_ID=$(jq -Rr 'fromjson? | select(.type == "thread.started") | .thread_id' "$events" 2>/dev/null | head -n 1)
  USAGE=$(jq -Rr 'fromjson? | select(.type == "turn.completed") | .usage | "\(.input_tokens)/\(.cached_input_tokens)/\(.output_tokens)"' "$events" 2>/dev/null | tail -n 1)
  PCT_AFTER=$(thread_used_percent "$THREAD_ID")
  [ -n "$PCT_AFTER" ] || PCT_AFTER=$(latest_used_percent)
}

# 표의 한 행을 파일로 남긴다. 파일 이름의 숫자가 표의 순서다. 일부 단계만 다시 돌려도 나머지 행이 남는다.
add_row() { # <행 파일 이름> <단계> <구성> <status>
  echo "| $2 | $3 | $4 | $SECS | $EXIT_CODE | ${THREAD_ID:--} | ${USAGE:--} | ${PCT_BEFORE:--} | ${PCT_AFTER:--} |" > "$ROWS_DIR/$1.row"
  echo "$2 [$3] status=$4 ${SECS}s exit=$EXIT_CODE thread=${THREAD_ID:--} used_percent=${PCT_BEFORE:--}->${PCT_AFTER:--}"
}

row_ok() { [ -f "$ROWS_DIR/$1.row" ] && grep -q '| ok |' "$ROWS_DIR/$1.row"; }

write_doc() {
  local config adopted schema look_len
  schema=$(env_get CODEX_USE_OUTPUT_SCHEMA)
  if [ -f "$ENV_FILE" ] && grep -q '^CODEX_MODEL=' "$ENV_FILE"; then
    config=$(config_label)
    if [ "$config" = A ]; then
      adopted="A (\`CODEX_MODEL=gpt-6-luna\`, \`CODEX_IGNORE_USER_CONFIG=1\`)"
    else
      adopted="B (\`CODEX_MODEL=\` 비움, \`CODEX_IGNORE_USER_CONFIG=0\`)"
    fi
  else
    config="?"
    adopted="미확정"
  fi
  {
    echo "# codex 실제 호출 스파이크"
    echo
    if grep -qs '| declined |' "$ROWS_DIR"/2*.row; then
      echo "> 실제 사진 거절: S2가 declined로 끝났다. 사유: $(cat "$SPIKE_DIR/s2-note.txt" 2>/dev/null). S3는 사람이 아닌 그림(sticker_tokki.png)을 참조로 호출 구성만 확인했다."
      echo
    fi
    if row_ok 41-s1a-retry || row_ok 51-s4-retry; then
      echo "> 글 호출 대체: 구성 $config 에서 \`--output-schema\`를 준 글 호출이 실패해 스키마 없이(프롬프트에 스키마와 \"Answer with JSON only\"를 붙여) 다시 받았다. 그래서 \`CODEX_USE_OUTPUT_SCHEMA=0\`으로 둔다."
      echo
    fi
    echo "문서 갱신: $(TZ=Asia/Seoul date '+%Y-%m-%d %H:%M KST'), $("$CODEX_BIN" --version 2>/dev/null | head -n 1). 만든 스크립트는 \`scripts/spike-codex.sh\`, 결과 파일은 \`data/lab/spike/\`(git 제외)에 있다."
    echo
    echo "모든 호출은 \`codex exec --json --skip-git-repo-check -s read-only -C data/lab/spike [구성 옵션] [-i <참조>...] [--output-schema <파일>] -o <파일> \"<프롬프트>\" < /dev/null\` 형식이다. 구성 A는 \`-m gpt-6-luna --ignore-user-config\`, 구성 B는 두 옵션 없음이다. S1은 구성 옵션 없이 실행했고, S1-A와 S4는 채택한 구성으로 실행한 글 호출이다(S4는 \`-i\` 두 장: 캐릭터, 사진 순서)."
    echo
    echo "| 단계 | 구성 | status | 시간(초) | exit | thread_id | usage(input/cached/output 토큰) | used_percent 전 | used_percent 후 |"
    echo "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
    cat "$ROWS_DIR"/*.row 2>/dev/null
    echo
    echo "- 실제 이미지 생성 수: $(ls "$ROWS_DIR" | grep -c '^[23]') (상한 $MAX_IMAGE_CALLS). S1, S1-A, S4는 글 호출이라 이미지를 만들지 않는다."
    echo "- 채택한 구성: $adopted"
    echo "- \`--output-schema\` 사용: ${schema:-미확정} (\`CODEX_USE_OUTPUT_SCHEMA\`)"
    if row_ok 40-s1a && row_ok 50-s4; then
      echo "- 채택한 구성의 글 호출: \`--output-schema\`와 함께 확인됨(S1-A 글만, S4 글과 입력 이미지 두 장)."
    elif row_ok 41-s1a-retry || row_ok 51-s4-retry; then
      echo "- 채택한 구성의 글 호출: 스키마 없는 형식으로만 확인됨(맨 위 참고)."
    else
      echo "- 채택한 구성의 글 호출: 아직 확인하지 않음(\`bash scripts/spike-codex.sh s1a s4\`)."
    fi
    if [ -f "$ROWS_DIR/30-s3.row" ]; then
      if [ -f "$SPIKE_DIR/s2.png" ]; then
        echo "- S3 참조: S2 결과(\`data/lab/spike/s2.png\`)"
      else
        echo "- S3 참조: \`.local/frontend-main-backup/public/sticker_tokki.png\`(사람이 아닌 그림)"
      fi
    fi
    look_len=$(jq -r '.charLook | length' "$SPIKE_DIR/s4.json" 2>/dev/null)
    [ -n "$look_len" ] && echo "- S4 charLook 길이: ${look_len}자(300자 이내). 내용은 실제 사람의 외모 묘사라 \`data/lab/spike/s4.json\`에만 둔다."
    echo "- status 뜻: \`ok\`(글 호출의 최종 메시지가 스키마에 맞음), \`generated\`, \`modified\`, \`declined\`, \`failed\`는 이미지 호출의 최종 메시지 값이고, \`timeout\`(제한 시간 초과로 프로세스 그룹 종료), \`error\`(exit 0 아님), \`bad_json\`(최종 메시지가 스키마와 다름), \`no_image\`(이 호출의 thread_id 폴더에 PNG 없음)는 스크립트가 붙인다."
  } > "$DOC_FILE"
}

fail() { # <종료 코드> <메시지>
  write_doc
  echo "$2" >&2
  exit "$1"
}

need_config() {
  if ! { [ -f "$ENV_FILE" ] && grep -q '^CODEX_MODEL=' "$ENV_FILE"; }; then
    fail 22 "채택한 구성이 없습니다. 먼저 s2를 실행해 주세요"
  fi
}

cat > "$SPIKE_DIR/intro.schema.json" <<'JSON'
{"type": "object", "additionalProperties": false, "required": ["intro", "question", "options", "illustration"],
 "properties": {"intro": {"type": "string"}, "question": {"type": "string"},
  "options": {"type": "array", "items": {"type": "string"}, "minItems": 3, "maxItems": 3},
  "illustration": {"type": "string"}}}
JSON
cat > "$SPIKE_DIR/image.schema.json" <<'JSON'
{"type": "object", "additionalProperties": false, "required": ["status", "note"],
 "properties": {"status": {"type": "string", "enum": ["generated", "modified", "declined", "failed"]}, "note": {"type": "string"}}}
JSON
cat > "$SPIKE_DIR/look.schema.json" <<'JSON'
{"type": "object", "additionalProperties": false, "required": ["charLook"],
 "properties": {"charLook": {"type": "string"}}}
JSON

INTRO_FILTER='(.intro | type == "string") and (.question | type == "string") and (.illustration | type == "string")
  and (.options | type == "array" and length == 3 and all(type == "string"))'
LOOK_FILTER='(keys == ["charLook"]) and (.charLook | type == "string" and length >= 1 and length <= 300)'

text_valid() { # <jq 검증식>
  [ "$TIMED_OUT" = 0 ] && [ "$EXIT_CODE" = 0 ] && message_json | jq -e "$1" >/dev/null 2>&1
}
text_status() {
  if [ "$TIMED_OUT" = 1 ]; then echo timeout; elif [ "$EXIT_CODE" != 0 ]; then echo error; else echo bad_json; fi
}

S1_PROMPT='아이를 위한 동화의 도입부를 한국어로 써 주세요. 주인공은 숲에서 모험을 시작하는 아이입니다(이름은 쓰지 않고 "주인공"이라고 부릅니다).
JSON 객체 하나로만 답합니다. 키: intro(도입부 3~4문장), question(다음에 무엇을 할지 묻는 질문 한 문장), options(선택지 문자열 정확히 3개), illustration(도입부 삽화를 설명하는 영어 한 문장).
셸 명령을 실행하지 말고 파일을 고치지 마세요.'

# ---------- S1 글 ----------
if want s1; then
  rm -f "$ROWS_DIR"/1*.row
  run_codex s1-schema "$TEXT_TIMEOUT_S" "$S1_PROMPT" --output-schema "$SPIKE_DIR/intro.schema.json"
  if text_valid "$INTRO_FILTER"; then
    add_row 10-s1 "S1" "스키마 있음" ok
    cp "$LAST_MSG" "$SPIKE_DIR/s1.json"
    set_env CODEX_USE_OUTPUT_SCHEMA 1
  else
    add_row 10-s1 "S1" "스키마 있음" "$(text_status)"
    run_codex s1-plain "$TEXT_TIMEOUT_S" "$S1_PROMPT
JSON만 출력하세요. 설명이나 코드 펜스를 붙이지 마세요."
    if text_valid "$INTRO_FILTER"; then
      add_row 11-s1-retry "S1 재시도" "스키마 없음" ok
      message_json > "$SPIKE_DIR/s1.json"
      set_env CODEX_USE_OUTPUT_SCHEMA 0
    else
      add_row 11-s1-retry "S1 재시도" "스키마 없음" "$(text_status)"
      fail 21 "S1 실패: 글 호출이 두 방식 모두 유효한 JSON을 주지 않았습니다"
    fi
  fi
fi

# ---------- 이미지 호출 ----------
IMAGE_CALLS=0
# image_call <행 파일 이름> <단계> <구성 A|B> <참조 이미지> <프롬프트> <결과 PNG 이름>. 결과: STATUS, NOTE
image_call() {
  local key=$1 step=$2 config=$3 ref=$4 prompt=$5 png_name=$6 opts png
  if [ "$IMAGE_CALLS" -ge "$MAX_IMAGE_CALLS" ]; then
    fail 24 "이미지 호출 상한(${MAX_IMAGE_CALLS}회)에 닿아 멈춥니다"
  fi
  IMAGE_CALLS=$((IMAGE_CALLS + 1))
  opts=(-i "$ref")
  [ "$config" = A ] && opts=(-m gpt-6-luna --ignore-user-config "${opts[@]}")
  [ "$(env_get CODEX_USE_OUTPUT_SCHEMA)" = 0 ] || opts=("${opts[@]}" --output-schema "$SPIKE_DIR/image.schema.json")
  run_codex "${key#*-}" "$IMAGE_TIMEOUT_S" "$prompt" "${opts[@]}"
  NOTE=""
  if [ "$TIMED_OUT" = 1 ]; then
    STATUS=timeout
  elif [ "$EXIT_CODE" != 0 ]; then
    STATUS=error
  else
    STATUS=$(message_json | jq -r 'if type == "object" and (.status | type == "string") then .status else "bad_json" end' 2>/dev/null)
    case "$STATUS" in generated | modified | declined | failed) ;; *) STATUS=bad_json ;; esac
    NOTE=$(message_json | jq -r '.note? // "" | tostring' 2>/dev/null | tr -d '|`\n\r' | cut -c 1-200)
  fi
  if [ "$STATUS" = generated ] || [ "$STATUS" = modified ]; then
    # 이 호출의 thread_id 폴더에서만 고른다(다른 스레드의 예전 PNG를 집지 않는다). exit 0이어도 PNG가 없으면 성공이 아니다.
    png=""
    [ -n "$THREAD_ID" ] && png=$(ls -t "$CODEX_HOME_DIR/generated_images/$THREAD_ID"/*.png 2>/dev/null | head -n 1)
    if [ -n "$png" ] && [ "$(head -c 8 "$png" | xxd -p)" = "$PNG_SIG" ]; then
      mv "$png" "$SPIKE_DIR/$png_name"
    else
      STATUS=no_image
    fi
  fi
  add_row "$key" "$step" "$config" "$STATUS"
}

# ---------- S2 사진으로 기준 캐릭터 ----------
if want s2; then
  rm -f "$ROWS_DIR"/2*.row "$SPIKE_DIR/s2.png" "$SPIKE_DIR/s2-note.txt"
  S2_PROMPT="Create exactly one storybook-style character portrait of the person in the reference photo. Use the image generation tool exactly once.
Keep the face shape, eyes, eyebrows, nose, mouth, skin tone, hairstyle, hair color and apparent age so that the person stays recognizable. Waist-up, facing the viewer, relaxed friendly expression, plain light background, wearing a plain single-color T-shirt.
Style: soft, warm children's storybook illustration. One character only. No text, no watermark, no border. Portrait orientation.
Permission: the person shown in the reference photo, or their guardian, has agreed to this use of their likeness.
Reference images (pass every path in referenced_image_paths):
$PHOTO - photo of the real person (identity source)
Do not run shell commands. Do not edit files. When the tool returns, answer with JSON only."

  CONFIG=A
  image_call 20-s2-a S2 A "$PHOTO" "$S2_PROMPT" s2.png
  case "$STATUS" in
    generated | modified | declined) ;;
    *)
      CONFIG=B
      image_call 21-s2-b S2 B "$PHOTO" "$S2_PROMPT" s2.png
      ;;
  esac
  case "$STATUS" in
    generated | modified) ;;
    declined) echo "${NOTE:-모델이 사유를 적지 않음}" > "$SPIKE_DIR/s2-note.txt" ;;
    *) fail 22 "S2 실패: 구성 A와 B 모두 기준 캐릭터를 만들지 못했습니다(마지막 status: $STATUS)" ;;
  esac

  if [ "$CONFIG" = A ]; then
    set_env CODEX_MODEL gpt-6-luna
    set_env CODEX_IGNORE_USER_CONFIG 1
  else
    set_env CODEX_MODEL ""
    set_env CODEX_IGNORE_USER_CONFIG 0
  fi
fi

# ---------- S3 캐릭터 참조 장면(조건 front) ----------
if want s3; then
  need_config
  rm -f "$ROWS_DIR"/3*.row "$SPIKE_DIR/s3.png"
  if [ -f "$SPIKE_DIR/s2.png" ]; then S3_REF="$SPIKE_DIR/s2.png"; else S3_REF="$FALLBACK_REF"; fi
  S3_PROMPT="Create exactly one children's storybook illustration. Use the image generation tool exactly once.
Scene: The character stands in a sunny forest clearing, facing the viewer directly, with a gentle smile. Upper body and face clearly visible.
Character identity: the main character is the same person as in the reference image(s). Keep the face shape, eyes, eyebrows, nose, mouth, skin tone, hairstyle and hair color. Keep the apparent age.
Outfit: the same outfit as the reference character
Style: soft, warm storybook illustration, consistent with the reference character image when one is given. One character only. No text, no watermark, no border. Portrait orientation.
Permission: the person shown in the reference image(s), or their guardian, has agreed to this use of their likeness.
Reference images (pass every path in referenced_image_paths):
$S3_REF - approved storybook character (identity and style source)
Do not run shell commands. Do not edit files. When the tool returns, answer with JSON only."

  image_call 30-s3 S3 "$(config_label)" "$S3_REF" "$S3_PROMPT" s3.png
  case "$STATUS" in
    generated | modified) ;;
    *) fail 23 "S3 실패: 장면을 만들지 못했습니다(status: $STATUS)" ;;
  esac
fi

# ---------- 채택한 구성의 글 호출 ----------
TEXT_FALLBACK=0
# text_step <행 번호> <라벨> <단계> <스키마 파일> <jq 검증식> <결과 파일> <프롬프트> [-i <이미지>...]
# 스키마를 준 호출이 실패하면 스키마 없이 한 번만 다시 한다. 이미지를 만들지 않는다.
text_step() {
  local num=$1 label=$2 name=$3 schema=$4 filter=$5 out=$6 prompt=$7 config opts
  shift 7
  need_config
  config=$(config_label)
  rm -f "$ROWS_DIR/$num-$label.row" "$ROWS_DIR/$((num + 1))-$label-retry.row" "$out"
  opts=("$@")
  [ "$config" = A ] && opts=(-m gpt-6-luna --ignore-user-config "$@")
  run_codex "$label" "$TEXT_TIMEOUT_S" "$prompt" ${opts[@]+"${opts[@]}"} --output-schema "$schema"
  if text_valid "$filter"; then
    add_row "$num-$label" "$name" "$config, 스키마 있음" ok
  else
    add_row "$num-$label" "$name" "$config, 스키마 있음" "$(text_status)"
    run_codex "$label-retry" "$TEXT_TIMEOUT_S" "$prompt
JSON schema: $(cat "$schema")
Answer with JSON only." ${opts[@]+"${opts[@]}"}
    if text_valid "$filter"; then
      add_row "$((num + 1))-$label-retry" "$name 재시도" "$config, 스키마 없음" ok
      TEXT_FALLBACK=1
    else
      add_row "$((num + 1))-$label-retry" "$name 재시도" "$config, 스키마 없음" "$(text_status)"
      echo "--- $label-retry stderr 끝부분 ---" >&2
      tail -n 5 "$SPIKE_DIR/$label-retry.stderr.txt" >&2
      fail 25 "$name 실패: 채택한 구성의 글 호출이 두 방식 모두 유효한 JSON을 주지 않았습니다(.env는 그대로 둡니다)"
    fi
  fi
  message_json > "$out"
}

if want s1a; then
  text_step 40 s1a "S1-A" "$SPIKE_DIR/intro.schema.json" "$INTRO_FILTER" "$SPIKE_DIR/s1a.json" "$S1_PROMPT"
fi

if want s4; then
  if [ ! -f "$SPIKE_DIR/s2.png" ]; then
    fail 22 "S4에는 data/lab/spike/s2.png가 필요합니다. 먼저 s2를 실행해 주세요"
  fi
  S4_PROMPT="The first image is a storybook character made from the person in the second image. Describe the character's look for an illustrator in one or two English sentences, at most 300 characters: start with 'A ... with ...' (face and hair), then 'Wearing ...' (outfit). No names. The person shown, or their guardian, has agreed to this use of their likeness. Do not run shell commands. Do not edit files. Answer with JSON only."
  text_step 50 s4 "S4" "$SPIKE_DIR/look.schema.json" "$LOOK_FILTER" "$SPIKE_DIR/s4.json" "$S4_PROMPT" -i "$SPIKE_DIR/s2.png" -i "$PHOTO"
  # 외모 묘사는 s4.json에만 남긴다: 최종 메시지 파일을 지우고 이벤트 기록에서 메시지 항목을 뺀다
  rm -f "$SPIKE_DIR"/s4.last-message.txt "$SPIKE_DIR"/s4-retry.last-message.txt
  for events in "$SPIKE_DIR"/s4.events.jsonl "$SPIKE_DIR"/s4-retry.events.jsonl; do
    [ -f "$events" ] || continue
    jq -Rc 'fromjson? | select(.type != "item.completed")' "$events" > "$events.tmp" && mv "$events.tmp" "$events"
  done
fi

if [ "$TEXT_FALLBACK" = 1 ]; then
  set_env CODEX_USE_OUTPUT_SCHEMA 0
fi

write_doc
echo "완료: $DOC_FILE, 실행한 단계: $STEPS, 이번 실행의 이미지 호출 ${IMAGE_CALLS}회"
