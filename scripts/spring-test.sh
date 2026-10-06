#!/usr/bin/env bash
# Spring 테스트 실행: .local/db.env와 JAVA_HOME을 내보내고 ./gradlew test를 돌린다. 인자는 gradle에 그대로 넘긴다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.local/db.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "spring-test.sh: missing $ENV_FILE (run scripts/setup-db.sh first)" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
export JAVA_HOME

cd "$ROOT_DIR/backend-springboot"
./gradlew test "$@"
