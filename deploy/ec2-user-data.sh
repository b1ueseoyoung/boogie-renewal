#!/bin/bash
# EC2 첫 부팅 때 한 번 실행: Docker 설치와 스왑 2GB
set -e
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt-get update -y
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
