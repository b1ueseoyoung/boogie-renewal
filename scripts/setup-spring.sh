#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.local/db.env"
SRC_PROPS="$ROOT_DIR/backend-springboot/src/main/resources/application-example.properties"
OUT_PROPS="$ROOT_DIR/backend-springboot/src/main/resources/application.properties"

if [ ! -f "$ENV_FILE" ]; then
  echo "setup-spring.sh: missing $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

if [ -z "${DB_USER:-}" ] || [ -z "${DB_PASSWORD:-}" ] || [ -z "${DB_NAME:-}" ]; then
  echo "setup-spring.sh: DB_USER, DB_PASSWORD, DB_NAME must be set in $ENV_FILE" >&2
  exit 1
fi

DB_URL="jdbc:mysql://localhost:3306/${DB_NAME}?serverTimezone=Asia/Seoul&characterEncoding=UTF-8"

OUT_TMP="$(mktemp)"
DB_URL="$DB_URL" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" awk '
  /^spring\.datasource\.url=/ { print "spring.datasource.url=" ENVIRON["DB_URL"]; next }
  /^spring\.datasource\.username=/ { print "spring.datasource.username=" ENVIRON["DB_USER"]; next }
  /^spring\.datasource\.password=/ { print "spring.datasource.password=" ENVIRON["DB_PASSWORD"]; next }
  { print }
' "$SRC_PROPS" > "$OUT_TMP"
printf '\nserver.address=127.0.0.1\n' >> "$OUT_TMP"
mv "$OUT_TMP" "$OUT_PROPS"

echo "setup-spring.sh: wrote application.properties"
