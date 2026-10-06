# codex 실제 호출 스파이크

문서 갱신: 2026-10-02 17:35 KST, codex-cli 0.157.1. 만든 스크립트는 `scripts/spike-codex.sh`, 결과 파일은 `data/lab/spike/`(git 제외)에 있다.

모든 호출은 `codex exec --json --skip-git-repo-check -s read-only -C data/lab/spike [구성 옵션] [-i <참조>...] [--output-schema <파일>] -o <파일> "<프롬프트>" < /dev/null` 형식이다. 구성 A는 `-m gpt-6-luna --ignore-user-config`, 구성 B는 두 옵션 없음이다. S1은 구성 옵션 없이 실행했고, S1-A와 S4는 채택한 구성으로 실행한 글 호출이다(S4는 `-i` 두 장: 캐릭터, 사진 순서).

| 단계 | 구성 | status | 시간(초) | exit | thread_id | usage(input/cached/output 토큰) | used_percent 전 | used_percent 후 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | 스키마 있음 | ok | 30.0 | 0 | 01a0fbb7-c6a8-70e1-87ba-636e8973dff3 | 17526/0/534 | 22.0 | 25.0 |
| S2 | A | generated | 41.9 | 0 | 01a0fbb8-3c2d-74f1-95eb-5eaac4512f9e | 29990/14080/277 | 25.0 | 25.0 |
| S3 | A | generated | 62.4 | 0 | 01a0fbb8-e247-7670-a8b6-0ae7b72ebfc0 | 34974/16128/315 | 25.0 | 25.0 |
| S1-A | A, 스키마 있음 | ok | 11.7 | 0 | 01a0fbc0-fc59-79e3-935e-6a28027c0c2f | 15334/0/192 | 25.0 | 25.0 |
| S4 | A, 스키마 있음 | ok | 10.6 | 0 | 01a0fbc1-2347-7462-97d0-f244d7fe54b8 | 16677/0/58 | 25.0 | 25.0 |

- 실제 이미지 생성 수: 2 (상한 4). S1, S1-A, S4는 글 호출이라 이미지를 만들지 않는다.
- 채택한 구성: A (`CODEX_MODEL=gpt-6-luna`, `CODEX_IGNORE_USER_CONFIG=1`)
- `--output-schema` 사용: 1 (`CODEX_USE_OUTPUT_SCHEMA`)
- 채택한 구성의 글 호출: `--output-schema`와 함께 확인됨(S1-A 글만, S4 글과 입력 이미지 두 장).
- S3 참조: S2 결과(`data/lab/spike/s2.png`)
- S4 charLook 길이: 174자(300자 이내). 내용은 실제 사람의 외모 묘사라 `data/lab/spike/s4.json`에만 둔다.
- status 뜻: `ok`(글 호출의 최종 메시지가 스키마에 맞음), `generated`, `modified`, `declined`, `failed`는 이미지 호출의 최종 메시지 값이고, `timeout`(제한 시간 초과로 프로세스 그룹 종료), `error`(exit 0 아님), `bad_json`(최종 메시지가 스키마와 다름), `no_image`(이 호출의 thread_id 폴더에 PNG 없음)는 스크립트가 붙인다.
