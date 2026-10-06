# 데모 배포 (AWS EC2)

꿈도깨비를 EC2 서버 한 대에 올려 HTTPS 주소로 보여 주는 절차다. 데모 모드라서 OpenAI와 codex를 부르지 않고 생성 비용이 들지 않는다.
- 책장: 이 Mac에 저장된 동화를 그대로 보여 준다.
- 새로 만들기: 끝까지 진행되지만 그림은 가짜(대역)다.
- 접속: 아이디와 비밀번호가 있어야 들어온다.

## 구성

```
브라우저 ──HTTPS──> Caddy (web: 프론트 + 자동 HTTPS + 아이디·비밀번호)
                     ├─ /api/* ─> Spring (8080) ─> MySQL
                     └─ /fa/*  ─> FastAPI (8000, GEN_FAKE=1) ─> 그림 파일(/data)
```

- 주소는 `https://<IP를 -로 이은 것>.sslip.io`다. sslip.io는 IP를 이름으로 바꿔 주는 무료 DNS라서, 도메인 없이도 Caddy가 Let's Encrypt 인증서를 받는다.
- 이미지는 이 Mac에서 빌드해 서버로 보낸다. 서버는 이 Mac과 같은 arm64(t4g.small, 2GB, 프리티어 대상)다.
- 고정 IP는 만들지 않는다. 꺼 둬도 요금이 나가기 때문이다. 대신 서버를 새로 만들면 주소가 바뀐다.

## 준비 (한 번)

1. Docker를 준비한다: `brew install colima docker docker-compose docker-buildx`, `colima start`
2. AWS CLI를 설치하고 키를 등록한다: `brew install awscli`, `aws configure`
   - 키는 IAM 사용자의 액세스 키이고, 이 사용자에게 `AmazonEC2FullAccess`가 있어야 한다.
   - 리전은 `ap-northeast-2`다.
3. 데모 데이터를 준비한다. `deploy/seed/dump.sql`, `deploy/data/files/`, `deploy/.env`가 있어야 하고, 모두 gitignore 대상이다.
   - `dump.sql`: 로컬 DB 덤프다. 그림 주소 `http://localhost:8000/files`를 `/fa/files`로 바꿔 둔다.
   - `data/files`: `data/files/{character,scene,storybook,uploads}`를 복사한다. `storybook/*/content.json` 안의 주소도 같은 방식으로 `/fa/files`로 바꾼다.
   - `.env`: `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `DEMO_USER`, `DEMO_PASSWORD_HASH`를 넣는다. 해시는 `docker run --rm caddy:2 caddy hash-password --plaintext <비밀번호>`로 만들고, 작은따옴표로 감싼다.

## 이 Mac에서 먼저 확인

```bash
cd deploy
HTTP_BIND=127.0.0.1:3101 HTTPS_BIND=127.0.0.1:3443 docker compose up -d --build
# http://localhost:3101 (아이디·비밀번호 필요)
docker compose down        # 데이터까지 지우려면 down -v
```

## 서버 만들기, 올리기, 지우기

```bash
deploy/ec2-up.sh     # 서버 생성(SSH는 지금 내 IP만 허용). 주소를 출력한다
deploy/ec2-push.sh   # 빌드, 전송, 기동. 다시 실행하면 새 이미지로 교체한다
deploy/ec2-down.sh   # 서버, 디스크, 보안 그룹, 키 페어 삭제. 이후 과금 0
```

- 서버 로그: `ssh -i ~/.ssh/kkum-demo.pem ubuntu@<IP> 'cd ~/kkum && sudo docker compose logs --tail 50'`
- 비용: 서버(t4g.small)와 공개 IPv4가 시간 단위로 과금된다. 프리티어 계정이면 크레딧에서 빠진다. 크레딧 없이도 하루 1달러 안팎(추정)이다. 중지만 하면 디스크 요금이 계속 나가니, 다 쓰면 `ec2-down.sh`로 지운다.
