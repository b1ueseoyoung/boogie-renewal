#!/usr/bin/env bash
# 대역 모드 API 흐름 QA(할 일 30): curl만으로 합성 사진 업로드 -> 캐릭터 -> 후보 승인 -> 도입 -> 장면 2개
# -> dev-down/dev-up --fake 재시작 -> 장면 3개(마지막은 결말). 마지막 응답이 201이고 이번 창작의 scene이
# page 0~5 각 1행이면 PASS(exit 0), 아니면 FAIL <사유>(exit 1).
# 사용법: bash scripts/qa-api-flow.sh
# 대역 모드 서버가 없으면 dev-up.sh --fake로 띄운다. 실제 모드 서버가 떠 있으면 dev-up.sh가 거절하므로 FAIL이다
# (실제 스키마 dreamgoblin과 data/에 QA 데이터를 쓰지 않는다).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPRING="http://localhost:8080"
FASTAPI="http://localhost:8000"
NAME="qa-api-$(date +%Y%m%d%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -f "$TMP"/*; rmdir "$TMP"' EXIT

fail() { echo "FAIL $*"; exit 1; }
step() { echo "- $*"; }

# json <경로> : 표준 입력의 JSON에서 a.b.0 형식의 경로 값을 출력한다
json() {
  python3 -c 'import sys, json
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d[int(k)] if isinstance(d, list) else d[k]
print(d if not isinstance(d, (dict, list)) else json.dumps(d, ensure_ascii=False))' "$1" 2>/dev/null
}

# post <url> <json 본문> <응답 파일> : HTTP 상태 코드를 출력한다
post() {
  curl -s -m 300 -o "$3" -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d "$2" "$1" || echo 000
}

up_fake() {
  bash "$ROOT_DIR/scripts/dev-up.sh" --fake > "$TMP/dev-up.log" 2>&1 \
    || fail "dev-up.sh --fake 실패: $(tail -n 3 "$TMP/dev-up.log" | tr '\n' ' ')"
  local mode
  mode="$(curl -s -m 5 "$FASTAPI/health" | json mode)"
  [ "$mode" = "fake" ] || fail "/health mode=$mode (fake가 아님)"
}

# story <기대 코드> <선택지가 든 직전 응답 파일> <응답 파일>
story() {
  local choice body code
  choice="$(json choices.0 < "$2")"
  [ -n "$choice" ] || fail "직전 응답에 choices가 없음: $(head -c 300 "$2")"
  body="$(python3 -c 'import sys, json; print(json.dumps({"choice": sys.argv[1]}, ensure_ascii=False))' "$choice")"
  code="$(post "$SPRING/story" "$body" "$3")"
  [ "$code" = "$1" ] || fail "POST /story 기대 $1, 실제 $code: $(head -c 300 "$3")"
  step "POST /story ($choice) -> $code"
}

up_fake
step "대역 모드 확인: $(curl -s -m 5 "$FASTAPI/health")"

python3 - "$TMP/qa-photo.png" <<'PY'
import struct, sys, zlib
w = h = 256
raw = b"".join(b"\x00" + bytes(v for x in range(w) for v in (x, y, (x + y) // 2)) for y in range(h))
def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
open(sys.argv[1], "wb").write(png)
PY

code="$(curl -s -m 60 -o "$TMP/upload.json" -w '%{http_code}' -F "file=@$TMP/qa-photo.png;type=image/png" "$FASTAPI/files/upload" || echo 000)"
[ "$code" = "200" ] || fail "POST /files/upload -> $code: $(head -c 300 "$TMP/upload.json")"
PHOTO_URL="$(json url < "$TMP/upload.json")"
step "POST /files/upload -> $code $PHOTO_URL"

body="$(python3 -c 'import sys, json; print(json.dumps({"charName": sys.argv[1], "userImg": sys.argv[2]}))' "$NAME" "$PHOTO_URL")"
code="$(post "$SPRING/character" "$body" "$TMP/character.json")"
[ "$code" = "200" ] || fail "POST /character -> $code: $(head -c 300 "$TMP/character.json")"
CHAR_ID="$(json charId < "$TMP/character.json")"
CANDIDATE_ID="$(json candidateId < "$TMP/character.json")"
step "POST /character ($NAME) -> $code charId=$CHAR_ID candidateId=$CANDIDATE_ID"

code="$(post "$SPRING/character/$CHAR_ID/approve" "{\"candidateId\":$CANDIDATE_ID}" "$TMP/approve.json")"
[ "$code" = "200" ] || fail "POST /character/$CHAR_ID/approve -> $code: $(head -c 300 "$TMP/approve.json")"
step "POST /character/$CHAR_ID/approve -> $code"

code="$(post "$SPRING/intro" "{\"charId\":$CHAR_ID,\"genre\":\"life\",\"place\":\"sea\"}" "$TMP/s0.json")"
[ "$code" = "200" ] || fail "POST /intro -> $code: $(head -c 300 "$TMP/s0.json")"
CREATION_ID="$(json creationId < "$TMP/s0.json")"
[ -n "$CREATION_ID" ] || fail "POST /intro 응답에 creationId가 없음"
step "POST /intro (life, sea) -> $code creationId=$CREATION_ID"

story 200 "$TMP/s0.json" "$TMP/s1.json"
story 200 "$TMP/s1.json" "$TMP/s2.json"

# 이야기 중간에 서버를 내렸다가 다시 띄운다
bash "$ROOT_DIR/scripts/dev-down.sh" > "$TMP/dev-down.log" 2>&1 || fail "dev-down.sh 실패: $(cat "$TMP/dev-down.log")"
deadline=$(( $(date +%s) + 60 ))
while lsof -ti tcp:3100 -ti tcp:8000 -ti tcp:8080 -sTCP:LISTEN > /dev/null 2>&1; do
  [ "$(date +%s)" -lt "$deadline" ] || fail "dev-down.sh 뒤 60초가 지나도 3100/8000/8080이 열려 있음"
  sleep 1
done
step "dev-down.sh -> 포트 3100/8000/8080 닫힘"
up_fake
step "dev-up.sh --fake -> 다시 뜸"

story 200 "$TMP/s2.json" "$TMP/s3.json"
story 200 "$TMP/s3.json" "$TMP/s4.json"
story 201 "$TMP/s4.json" "$TMP/s5.json"
TITLE="$(json title < "$TMP/s5.json")"
CONTENT_URL="$(json contentUrl < "$TMP/s5.json")"
[ -n "$TITLE" ] && [ -n "$CONTENT_URL" ] || fail "201 응답에 title/contentUrl이 없음: $(head -c 300 "$TMP/s5.json")"
step "결말: title=$TITLE contentUrl=$CONTENT_URL"

OWNER="$(mysql -uroot dreamgoblin_qa -N -e "select charID from creation where creationID = $CREATION_ID" 2>&1)"
[ "$OWNER" = "$CHAR_ID" ] || fail "creation $CREATION_ID 의 charID=$OWNER (기대 $CHAR_ID)"
PAGES="$(mysql -uroot dreamgoblin_qa -N -e "select page from scene where creationID = $CREATION_ID order by page" 2>&1 | tr '\n' ' ')"
step "scene pages (creationID=$CREATION_ID): $PAGES"
[ "$PAGES" = "0 1 2 3 4 5 " ] || fail "scene pages가 0~5 각 1행이 아님: $PAGES"

echo "PASS"
