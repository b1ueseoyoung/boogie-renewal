#!/usr/bin/env bash
# 이 Mac에서 이미지를 빌드해 서버로 보내고 데모 스택을 띄운다. 다시 실행하면 새 이미지로 갈아 끼운다.
set -euo pipefail
cd "$(dirname "$0")"
. ./.ec2-state
KEY=~/.ssh/kkum-demo.pem
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@$IP"
until $SSH true 2>/dev/null; do sleep 5; done
$SSH 'cloud-init status --wait' >/dev/null
docker compose build
docker save kkum/web:demo kkum/spring:demo kkum/fastapi:demo | gzip | $SSH 'gunzip | sudo docker load'
$SSH 'mkdir -p ~/kkum'
rsync -az -e "ssh -i $KEY" compose.yml seed data ubuntu@"$IP":~/kkum/
{ grep -v -E '^(SITE_ADDRESS|HTTP_BIND|HTTPS_BIND)=' .env; echo "SITE_ADDRESS=${IP//./-}.sslip.io"; } \
  | $SSH 'umask 077 && cat > ~/kkum/.env'
$SSH 'cd ~/kkum && sudo docker compose up -d --no-build'
echo "https://${IP//./-}.sslip.io"
