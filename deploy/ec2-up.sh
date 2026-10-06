#!/usr/bin/env bash
# EC2 한 대를 만든다: 키 페어, 보안 그룹(SSH는 지금 내 IP만, 80/443은 모두), Ubuntu 24.04 arm64.
# 고정 IP(Elastic IP)는 만들지 않는다(꺼 둬도 과금). 지울 때는 ec2-down.sh.
set -euo pipefail
cd "$(dirname "$0")"
NAME=kkum-demo
export AWS_REGION=${AWS_REGION:-ap-northeast-2} AWS_PAGER=""
TYPE=${INSTANCE_TYPE:-t4g.small}  # 프리티어 대상(2GB, arm64: 이 Mac에서 빌드한 이미지 그대로). 메모리가 모자라면 INSTANCE_TYPE=t4g.medium
KEY=~/.ssh/$NAME.pem
[ -f .ec2-state ] && { echo "이미 만든 서버가 있습니다(.ec2-state). 먼저 ec2-down.sh"; exit 1; }

if [ ! -f "$KEY" ]; then
  mkdir -p ~/.ssh
  aws ec2 create-key-pair --key-name $NAME --query KeyMaterial --output text > "$KEY"
  chmod 600 "$KEY"
fi
VPC=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$NAME Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = None ]; then
  SG=$(aws ec2 create-security-group --group-name $NAME --description "kkumdokkaebi demo" --vpc-id $VPC --query GroupId --output text)
  MYIP=$(curl -s https://checkip.amazonaws.com)
  aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 22 --cidr $MYIP/32 >/dev/null
  aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null
  aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 443 --cidr 0.0.0.0/0 >/dev/null
fi
AMI=$(aws ec2 describe-images --owners 099720109477 \
  --filters 'Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*' \
  --query 'sort_by(Images,&CreationDate)[-1].ImageId' --output text)
ID=$(aws ec2 run-instances --image-id $AMI --instance-type $TYPE --key-name $NAME --security-group-ids $SG \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3,DeleteOnTermination=true}' \
  --user-data file://ec2-user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
  --query 'Instances[0].InstanceId' --output text)
printf 'ID=%s\nSG=%s\n' "$ID" "$SG" > .ec2-state
aws ec2 wait instance-running --instance-ids $ID
IP=$(aws ec2 describe-instances --instance-ids $ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
printf 'IP=%s\n' "$IP" >> .ec2-state
echo "서버 $ID, IP $IP, 주소 https://${IP//./-}.sslip.io"
