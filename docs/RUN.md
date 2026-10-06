# ver.0.1 로컬 실행 가이드

## 준비

1. MySQL을 brew로 켠다: `brew services start mysql`.
2. `bash scripts/setup-db.sh` — DB·사용자·`.local/db.env`를 만든다(최초 1회).
3. `bash scripts/setup-spring.sh` — `application.properties`를 생성한다(최초 1회, `dev-up.sh`가 없으면 자동 실행).
4. 사진은 `data/photos/`에 넣는다. `jpg`, `jpeg`, `png` (대소문자 무관)만 인식한다.

## 실행과 종료

- 대역(가짜) 모드: `bash scripts/dev-up.sh --fake`
- 실제 모드: `bash scripts/dev-up.sh`
- 종료: `bash scripts/dev-down.sh`
- 세 주소가 모두 200이 될 때까지 최대 180초 기다리며, 완료되면 FastAPI(`http://localhost:8000`), Spring(`http://localhost:8080`), React(`http://localhost:3100`) 주소와 모드를 출력한다.
- 이미 같은 모드로 떠 있으면 아무것도 새로 띄우지 않고 exit 0, 다른 모드거나 다른 프로세스가 포트를 쓰고 있으면 exit 1이고 서버는 그대로 둔다.

## 모드

- 대역(`GEN_FAKE=1`): `.local/qa-data`를 쓰고 실제 Codex를 호출하지 않는다(`CODEX_BIN=/nonexistent/codex`).
- 실제(`GEN_FAKE=0`): `data/`를 쓰고 실제 Codex를 호출해 사진을 OpenAI로 보낸다.
- `DEMO_REPLAY=1`: 저장된 결과만 재생한다(새로 생성하지 않음).
- `DEMO_REPLAY=prefer`: 저장본이 있으면 먼저 쓰는 시연용 모드. "다시 만들기"도 저장본을 돌려주므로, 시연은 이미 승인된 캐릭터로 진행한다.

## 실험 명령과 이어 하기

저장소 루트에서 시작한다.

```
bash scripts/check-env.sh
```

`docs/baseline-env.md`의 `status`가 `AVAILABLE`이면 기준선 비교군을 쓰기 전에 ComfyUI를 띄운다:

```
bash scripts/comfy-up.sh
```

이제 `backend-fastAPI`로 들어가 순서대로 진행한다:

```
cd backend-fastAPI
uv run python -m app.lab base-character --photo <data/photos의 첫 사진>
uv run python -m app.lab pilot
uv run python -m app.lab verify
uv run python -m app.lab run --rounds auto
uv run python -m app.lab status --json
uv run python -m app.lab.report
```

- `base-character`: `--photo`를 생략하면 `DATA_DIR/photos`의 첫 파일(이름순)을 쓴다.
- `run`은 `--rounds auto` 또는 `--rounds <N>`을 받는다.
- 끝나면 ComfyUI를 내린다: `bash scripts/comfy-down.sh`.

이어 하기: `run --rounds auto`를 다시 실행하면 `data/lab/manifest.jsonl`에 이미 끝난 조건은 다시 만들지 않고 이어서 진행한다.

- 종료 코드 20: 한도 규칙이 걸려 멈췄다는 뜻이다. `uv run python -m app.lab status --json`의 `resets_at`(epoch 초)을 확인하고, 그 시각 이후에 같은 `run --rounds auto`를 다시 실행한다.
- 종료 코드 21: 라운드 검사(`verify`)가 실패했다는 뜻이다. 그대로 이어 하지 말고 `uv run python -m app.lab verify`의 출력으로 원인을 먼저 본다.

## 검토자 안내

검토는 실제 모드로 띄운 뒤 `http://localhost:8000/lab/review` 에서 한다. 대역 모드로 떠 있으면 먼저 내린다:

```
bash scripts/dev-down.sh
bash scripts/dev-up.sh
```

`--fake`를 붙이면 안 된다. 대역 모드는 `DATA_DIR`을 `.local/qa-data`로 바꾸는데, 검토 과제는 `DATA_DIR/lab/manifest.jsonl`에서 만들어진다. 실험 그림의 매니페스트는 `data/lab`에만 있으니, 대역 모드에서는 과제가 0개라 그림이 하나도 안 보인다. 검토 화면은 이미 만든 실험 그림만 보여 주므로, 실제 모드여도 새 생성은 일어나지 않는다.

이 Mac에서 한 명씩 순서대로 평가한다(동시 접속 금지). 검토자 3명, 과제 수, 끝난 뒤 리포트를 다시 만들고 결론 줄을 바꾸는 절차는 [`docs/v0.1-report.md`](v0.1-report.md) 8절을 따른다.

## 리포트 다시 만들기

```
cd backend-fastAPI && uv run python -m app.lab.report
```

## 생성 방식 바꾸기

`GEN_METHOD` 환경변수로 바꾼다: `gpt_char`, `gpt_char_photo`, `gpt_photo`, `baseline_repaired` 중 하나.

## 테스트 명령

- FastAPI: `cd backend-fastAPI && uv run pytest -q`
- Spring: `bash scripts/spring-test.sh` (키그 전용 `openjdk@21`의 `JAVA_HOME`을 설정해서 돌린다. `./gradlew test`를 바로 실행하면 `JAVA_HOME` 없이 실패한다)
- React: 프론트에는 단위 테스트가 없다(`frontend/src`에 `*.test.*`/`*.spec.*` 파일 없음). 빌드로 대신 확인한다: `cd frontend && bun run build`

## 한도와 초기화 시각 확인

```
bash scripts/check-env.sh
```

저장소 루트에서 실행한다. 종료 코드: 0 정상, 10 사진 없음, 11 ChatGPT 로그인 아님, 12 이미지 생성 기능 꺼짐. 11과 12는 아무것도 출력하지 않는다.

## 문제 해결

- 로그 위치: `.local/run/fastapi.log`, `.local/run/spring.log`, `.local/run/react.log`.
- 포트 충돌: `bash scripts/dev-down.sh` 후 `lsof -nP -iTCP:3100 -iTCP:8000 -iTCP:8080 -sTCP:LISTEN`로 비어 있는지 확인하고 다시 `dev-up.sh`.
- 한도 소진: `bash scripts/check-env.sh`의 `used_percent`/`resets_at`을 확인한다.
- 기준선(ComfyUI + IP-Adapter) 재현 불가: `docs/baseline-env.md`의 `status`를 확인한다. `UNAVAILABLE`이면 `bash scripts/comfy-setup.sh`로 모델(약 5.3GB)을 내려받고 스모크를 다시 돌린다. `AVAILABLE`인데 안 되면 `bash scripts/comfy-up.sh`로 ComfyUI를 띄우고 `http://127.0.0.1:8188`이 응답하는지 확인한 뒤, 끝나면 `bash scripts/comfy-down.sh`로 내린다.

## 개인정보

- 업로드한 사진은 Codex를 통해 OpenAI로 전송된다.
- Codex는 요청과 결과를 `~/.codex/sessions`, `~/.codex/generated_images`에 남긴다.
- `data/`는 git에서 제외된다. 사진과 결과를 지우려면 `data/`를 직접 지우면 된다.
- ChatGPT 데이터 제어에서 "모델 학습에 사용" 옵션을 꺼 둔다.
- 본인 외 다른 사람의 사진은 동의를 받은 경우에만 사용한다.
