#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.local/db.env"

MY_CNF="$(brew --prefix)/etc/my.cnf"
BIND_LINE1="bind-address = 127.0.0.1"
BIND_LINE2="mysqlx-bind-address = 127.0.0.1"

if [ ! -f "$MY_CNF" ]; then
  printf '[mysqld]\n%s\n%s\n' "$BIND_LINE1" "$BIND_LINE2" > "$MY_CNF"
elif ! grep -q '^\[mysqld\]' "$MY_CNF"; then
  printf '[mysqld]\n%s\n%s\n' "$BIND_LINE1" "$BIND_LINE2" >> "$MY_CNF"
else
  MY_CNF_TMP="$(mktemp)"
  awk -v l1="$BIND_LINE1" -v l2="$BIND_LINE2" '
    function flush_missing() {
      if (in_sec) {
        if (!has1) print l1
        if (!has2) print l2
      }
    }
    /^\[mysqld\]/ {
      flush_missing()
      print
      in_sec = 1; has1 = 0; has2 = 0
      next
    }
    /^\[/ {
      flush_missing()
      in_sec = 0
      print
      next
    }
    {
      if (in_sec) {
        if ($0 == l1) has1 = 1
        if ($0 == l2) has2 = 1
      }
      print
    }
    END { flush_missing() }
  ' "$MY_CNF" > "$MY_CNF_TMP"
  if cmp -s "$MY_CNF_TMP" "$MY_CNF"; then
    rm -f "$MY_CNF_TMP"
  else
    cat "$MY_CNF_TMP" > "$MY_CNF"
    rm -f "$MY_CNF_TMP"
  fi
fi

CURRENT_BIND="$(mysql -uroot -N -e "select concat(@@bind_address, ' ', @@mysqlx_bind_address)" 2>/dev/null || true)"
if [ "$CURRENT_BIND" != "127.0.0.1 127.0.0.1" ]; then
  SERVICE_NAME="$(brew services list | awk '$1 ~ /^mysql(@[0-9.]+)?$/ && $2 == "started" {print $1; exit}')"
  if [ -z "$SERVICE_NAME" ]; then
    echo "setup-db.sh: no started mysql brew service found to restart" >&2
    exit 1
  fi
  brew services restart "$SERVICE_NAME" >/dev/null
  PING_OK=0
  for _ in $(seq 1 60); do
    if mysqladmin -uroot ping >/dev/null 2>&1; then
      PING_OK=1
      break
    fi
    sleep 1
  done
  if [ "$PING_OK" -ne 1 ]; then
    echo "setup-db.sh: mysqld did not respond to ping within 60s after restart" >&2
    exit 1
  fi
fi

mkdir -p "$ROOT_DIR/.local"

if [ ! -f "$ENV_FILE" ]; then
  PASSWORD="$(openssl rand -hex 16)"
  cat > "$ENV_FILE" <<EOF
DB_USER=dreamgoblin
DB_PASSWORD=$PASSWORD
DB_NAME=dreamgoblin
DB_TEST_NAME=dreamgoblin_test
DB_QA_NAME=dreamgoblin_qa
EOF
  chmod 600 "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS \`${DB_TEST_NAME}\` CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS \`${DB_QA_NAME}\` CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_TEST_NAME}\`.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB_QA_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "setup-db.sh: ok"
