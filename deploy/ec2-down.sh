#!/usr/bin/env bash
# 서버를 지운다(중지가 아니라 삭제: 이후 과금 0). 디스크도 함께 지워지고, 보안 그룹과 키 페어도 지운다.
set -euo pipefail
cd "$(dirname "$0")"
export AWS_REGION=${AWS_REGION:-ap-northeast-2} AWS_PAGER=""
. ./.ec2-state
aws ec2 terminate-instances --instance-ids "$ID" >/dev/null
aws ec2 wait instance-terminated --instance-ids "$ID"
aws ec2 delete-security-group --group-id "$SG"
aws ec2 delete-key-pair --key-name kkum-demo
rm -f ~/.ssh/kkum-demo.pem .ec2-state
echo "삭제 완료: $ID"
