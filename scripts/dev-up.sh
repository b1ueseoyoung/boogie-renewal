#!/usr/bin/env bash
# 꿈도깨비 로컬 실행: FastAPI(8000) + Spring(8080) + React(3100)을 띄운다.
# 사용법: scripts/dev-up.sh [--fake]
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.local/run"
mkdir -p "$RUN_DIR"

FAKE=0
if [ "${1:-}" = "--fake" ]; then
  FAKE=1
fi

ENV_FILE="$ROOT_DIR/.local/db.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "dev-up.sh: .local/db.env가 없습니다. 먼저 bash scripts/setup-db.sh를 실행하세요" >&2
  exit 1
fi

if ! mysqladmin -uroot ping >/dev/null 2>&1; then
  echo "dev-up.sh: MySQL에 연결할 수 없습니다. brew services start mysql 로 먼저 켜 주세요" >&2
  exit 1
fi

APPLICATION_PROPS="$ROOT_DIR/backend-springboot/src/main/resources/application.properties"
if [ ! -f "$APPLICATION_PROPS" ]; then
  bash "$ROOT_DIR/scripts/setup-spring.sh"
fi

if [ "$FAKE" -eq 1 ]; then
  MODE="fake"
  export GEN_FAKE=1
  export DATA_DIR="$ROOT_DIR/.local/qa-data"
  export CODEX_BIN=/nonexistent/codex
  export SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/dreamgoblin_qa?serverTimezone=Asia/Seoul&characterEncoding=UTF-8"
else
  MODE="real"
  export GEN_FAKE=0
  export DATA_DIR="$ROOT_DIR/data"
fi
mkdir -p "$DATA_DIR"

GEN_METHOD="${GEN_METHOD:-gpt_char}"
GEN_FAKE_DELAY_MS="${GEN_FAKE_DELAY_MS:-0}"
DEMO_REPLAY="${DEMO_REPLAY:-0}"
DEMO_CAP_POINTS="${DEMO_CAP_POINTS:-10}"
export GEN_METHOD GEN_FAKE_DELAY_MS DEMO_REPLAY DEMO_CAP_POINTS

check_health() {
  local out
  out="$(curl -s -m 3 "http://localhost:8000/health" 2>/dev/null)" || return 1
  [ -n "$out" ] || return 1
  printf '%s' "$out"
}

PORTS_LISTENING="$(lsof -nP -iTCP:3100 -iTCP:8000 -iTCP:8080 -sTCP:LISTEN 2>/dev/null | tail -n +2 || true)"
if [ -n "$PORTS_LISTENING" ]; then
  HEALTH_OUT="$(check_health || true)"
  HEALTH_MODE="$(printf '%s' "$HEALTH_OUT" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("mode",""))' 2>/dev/null || true)"
  HEALTH_METHOD="$(printf '%s' "$HEALTH_OUT" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("method",""))' 2>/dev/null || true)"
  HEALTH_REPLAY="$(printf '%s' "$HEALTH_OUT" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("replay",""))' 2>/dev/null || true)"

  SAME_MODE=0
  if [ "$HEALTH_MODE" = "$MODE" ] && [ "$HEALTH_METHOD" = "$GEN_METHOD" ] && [ "$HEALTH_REPLAY" = "$DEMO_REPLAY" ]; then
    SAME_MODE=1
  fi

  ALL_200=1
  for url in "http://localhost:8000/health" "http://localhost:8080/mypage/character" "http://localhost:3100"; do
    code="$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] || ALL_200=0
  done

  if [ "$SAME_MODE" -eq 1 ] && [ "$ALL_200" -eq 1 ]; then
    echo "이미 실행 중입니다 (mode=$MODE)"
    echo "http://localhost:8000/health"
    echo "http://localhost:8080/mypage/character"
    echo "http://localhost:3100"
    exit 0
  else
    echo "다른 모드로 떠 있거나 다른 프로세스가 포트를 쓰고 있습니다. bash scripts/dev-down.sh 뒤 다시 실행하세요" >&2
    exit 1
  fi
fi

JAVA_HOME_OPENJDK="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"

set -m
(cd "$ROOT_DIR/backend-fastAPI" && DATA_DIR="$DATA_DIR" GEN_FAKE="$GEN_FAKE" GEN_METHOD="$GEN_METHOD" GEN_FAKE_DELAY_MS="$GEN_FAKE_DELAY_MS" DEMO_REPLAY="$DEMO_REPLAY" DEMO_CAP_POINTS="$DEMO_CAP_POINTS" CODEX_BIN="${CODEX_BIN:-codex}" nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 < /dev/null > "$RUN_DIR/fastapi.log" 2>&1 &)
(cd "$ROOT_DIR/backend-springboot" && JAVA_HOME="$JAVA_HOME_OPENJDK" nohup ./gradlew bootRun < /dev/null > "$RUN_DIR/spring.log" 2>&1 &)
(cd "$ROOT_DIR/frontend" && BROWSER=none HOST=127.0.0.1 PORT=3100 nohup bun run start < /dev/null > "$RUN_DIR/react.log" 2>&1 &)

wait_for() {
  local url="$1" deadline=$(( $(date +%s) + 180 ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$url" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  return 1
}

FAILED=0
for url in "http://localhost:8000/health" "http://localhost:8080/mypage/character" "http://localhost:3100"; do
  if ! wait_for "$url"; then
    echo "dev-up.sh: $url 가 180초 안에 200을 응답하지 않았습니다" >&2
    FAILED=1
  fi
done

if [ "$FAILED" -eq 1 ]; then
  echo "--- fastapi.log tail ---" >&2
  tail -n 40 "$RUN_DIR/fastapi.log" >&2 2>/dev/null
  echo "--- spring.log tail ---" >&2
  tail -n 40 "$RUN_DIR/spring.log" >&2 2>/dev/null
  echo "--- react.log tail ---" >&2
  tail -n 40 "$RUN_DIR/react.log" >&2 2>/dev/null
  exit 1
fi

echo "mode=$MODE"
echo "http://localhost:8000/health"
echo "http://localhost:8080/mypage/character"
echo "http://localhost:3100"
exit 0
