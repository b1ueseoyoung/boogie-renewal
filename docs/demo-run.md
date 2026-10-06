# 실제 생성 데모 기록 (할 일 31)

- 실행일: 2026-10-05 01:28~01:43 KST (2026-10-04 16:28~16:43 UTC)
- 결과: **완주**(중단 없음). `limit`이나 `declined`로 멈추지 않았다.
- 실행 명령: `bash scripts/check-env.sh`(exit 0, used_percent 0.0, 초기화 2026-10-10 10:55 KST) 뒤 `GEN_METHOD=gpt_char DEMO_CAP_POINTS=10 bash scripts/dev-up.sh`(실제 모드, 스키마 `dreamgoblin`, `DATA_DIR=data`).
  - 주의: 실제 모드의 `dev-up.sh`는 Spring에 `SPRING_DATASOURCE_URL`을 빈 값으로 넘겨 Spring이 "Failed to configure a DataSource"로 뜨지 않았다. 그래서 `application.properties`와 같은 주소를 앞에 붙여 다시 실행했다: `SPRING_DATASOURCE_URL='jdbc:mysql://localhost:3306/dreamgoblin?serverTimezone=Asia/Seoul&characterEncoding=UTF-8' GEN_METHOD=gpt_char DEMO_CAP_POINTS=10 bash scripts/dev-up.sh`.
- 흐름: `data/photos`의 첫 사진 `IMG_5004.JPG`, 이름 `서영`, 첫 후보 승인("다시 만들기" 누르지 않음), 장르 모험, 장소 바다, 선택지는 매번 첫 번째(푸른 게, 인어, 열쇠, 인어, 조개).
- 완성된 동화: `storyID 261005EFNC`, 제목 "바다의 심장", `data/files/storybook/261005EFNC/content.json`. `scene` 6행(page 0~5), 그림 6장 모두 `data/files/scene/` 아래 PNG.
- 닮았는지는 판단하지 않았다(사람이 판단할 몫).

## 건별 기록 (`data/lab/gen-log.jsonl` 68~82행, 이번 실제 흐름)

| # | 단계 | 종류 | 상태 | 지연(초) | 시도 | used_percent 전 | used_percent 후 | 증가 |
| - | - | - | - | - | - | - | - | - |
| 1 | 기준 캐릭터 후보 | 그림 | ok | 43.2 | 1 | (기록 없음, check-env 0.0) | 0.0 | 0.0 |
| 2 | 특징 문장(charLook) | 글 | ok | 12.7 | 1 | 0.0 | 0.0 | 0.0 |
| 3 | 도입 글 | 글 | ok | 8.4 | 1 | 0.0 | 0.0 | 0.0 |
| 4 | 도입 그림(page 0) | 그림 | ok | 38.1 | 1 | 0.0 | 0.0 | 0.0 |
| 5 | 1장 글 | 글 | ok | 11.7 | 1 | 0.0 | 0.0 | 0.0 |
| 6 | 1장 그림(page 1) | 그림 | ok | 36.4 | 1 | 0.0 | 0.0 | 0.0 |
| 7 | 2장 글 | 글 | ok | 10.8 | 1 | 0.0 | 0.0 | 0.0 |
| 8 | 2장 그림(page 2) | 그림 | ok | 41.7 | 1 | 0.0 | 0.0 | 0.0 |
| 9 | 3장 글 | 글 | ok | 13.6 | 1 | 0.0 | 0.0 | 0.0 |
| 10 | 3장 그림(page 3) | 그림 | ok | 49.7 | 1 | 0.0 | 0.0 | 0.0 |
| 11 | 4장 글 | 글 | ok | 14.3 | 1 | 0.0 | 0.0 | 0.0 |
| 12 | 4장 그림(page 4) | 그림 | ok | 37.3 | 1 | 0.0 | 0.0 | 0.0 |
| 13 | 결말 글 | 글 | ok | 8.2 | 1 | 0.0 | 0.0 | 0.0 |
| 14 | 전체 다듬기(제목, 요약) | 글 | ok | 33.4 | 1 | 0.0 | 0.0 | 0.0 |
| 15 | 결말 그림(page 5) | 그림 | ok | 40.4 | 1 | 0.0 | 0.0 | 0.0 |

- 합계: 15건(그림 7장 = 캐릭터 1 + 장면 6, 글 8건), 모두 `ok`, 재시도 0. 그림 평균 41.0초, 글 평균 14.1초. 브라우저 기준으로는 캐릭터 43초, 장면마다 46~63초, 마지막 장면(결말 글 + 다듬기 + 그림) 82초가 걸렸다.
- `used_percent`: 시작 0.0, 끝 0.0, 증가 0.0(상한 10, 수락 기준 11 이하). codex가 이 창(초기화 2026-10-10 10:55 KST)에서 그림 7장 뒤에도 0.0을 보고했다. 그래서 이 수치로는 건별 소진량을 알 수 없다. 할 일 10의 시험에서는 그림 약 6장에 3포인트가 올랐다.

## 재생 확인 (`DEMO_REPLAY=1`)

- `bash scripts/dev-down.sh` 뒤 `DEMO_REPLAY=1 bash scripts/dev-up.sh`(앞과 같은 `SPRING_DATASOURCE_URL` 우회). "기존 캐릭터를 사용하기"로 서영을 고르고 같은 장르, 장소, 선택으로 한 편을 다시 만들었다.
- 두 번째 동화 `261005JMVO`("바다의 심장")가 4.5초 만에 끝났다. 추가된 gen-log 83~95행 13건이 모두 `"cached": true`, `ok`다. 캐릭터와 특징 문장 행이 없는 이유는 승인된 후보를 다시 승인할 때 FastAPI를 부르지 않기 때문이다. codex rollout 파일 수는 78개 그대로다(새 호출 없음).
- 그림: 두 번째 동화 `content.json`의 그림 6장은 첫 번째와 **바이트가 같다**(sha256 6/6 일치). 하지만 **주소는 다르다**(0/6 일치). FastAPI `_picture()`(`backend-fastAPI/app/api/generate.py`)가 요청마다 `scene/<uuid4>.png` 새 이름을 정하고, 캐시 적중 때 `store._load()`(`backend-fastAPI/app/gen/store.py`)가 저장본을 그 새 경로로 복사하기 때문이다. 그래서 수락 기준 "그림 주소 6개가 첫 번째와 같다"는 충족되지 않았다. 고치려면 캐시 적중 때 처음 만든 파일 주소를 돌려주도록 코드를 바꿔야 하고, 이 할 일의 범위 밖이다.
- `replay_miss`: 재생 모드에서 세 번째 창작을 시작해 1장에서 두 번째 선택지("은빛 물고기")를 고르자 "지금은 저장된 동화만 볼 수 있어요."가 보였다(gen-log 98행 `replay_miss`, 그 앞 96~97행 도입 글과 그림은 `cached`). 그 뒤 `/bookshelf`에서 저장된 동화가 6쪽으로 열렸다.

### 할 일 40 뒤 다시 확인 (2026-10-05 15:02~15:04 KST)

- 고친 것: 캐시 적중이 저장본을 새 이름으로 복사하지 않고 처음 저장된 그림 경로를 그대로 돌려준다(`backend-fastAPI/app/gen/store.py`). 저장 경로가 없는 옛 저장본은 그 키를 처음 생성한 gen-log 행의 경로를 찾아 적어 둔다. `scripts/dev-up.sh`는 실제 모드에서 Spring에 빈 `SPRING_DATASOURCE_URL`을 넘기지 않는다.
- 기동: `SPRING_DATASOURCE_URL`을 설정하지 않은 셸에서 `GEN_METHOD=gpt_char DEMO_CAP_POINTS=10 bash scripts/dev-up.sh`가 exit 0, `/health`는 `mode real`이었다. 위의 주소 우회는 이제 필요 없다.
- 재생: `dev-down.sh` 뒤 `GEN_METHOD=gpt_char DEMO_CAP_POINTS=10 DEMO_REPLAY=1 bash scripts/dev-up.sh`로 띄우고 같은 경로로 세 번째 동화 `261005SWWT`를 만들었다. 그림 주소 6개가 첫 번째 `261005EFNC`와 **모두 같다**(6/6). 동화를 만든 gen-log 99~111행 13건이 모두 `"cached": true`다. codex rollout 파일 수는 88개 그대로다(새 호출 없음).
- `replay_miss`: 이어서 네 번째 창작의 1장에서 두 번째 선택지("은빛 물고기")를 고르자 같은 문구가 보였고(gen-log 114행, codex를 부르지 않는다), `/bookshelf`에서 저장된 동화 `261005EFNC`가 6쪽으로 열렸다.
- 증거: `.omo/evidence/task-40-kkumdokkaebi-v0-1.txt`, `.omo/evidence/task-40-kkumdokkaebi-v0-1.png`(replay_miss 문구)

## 증거

- `.omo/evidence/task-31-kkumdokkaebi-v0-1.txt`: 실행한 명령과 출력, 종료 코드
- `.omo/evidence/task-31-kkumdokkaebi-v0-1.png`(읽기 화면), `-real-bookshelf-1280.png`(책장), `-replay-miss-1280.png`(replay_miss 문구) 외 스크린샷
