# 꿈도깨비 v0.1 실험 프로토콜

기계가 읽는 원본은 `backend-fastAPI/app/lab/protocol.json`이다. 이 문서와 JSON은 계획의 Contracts C-6, C-7을 그대로 옮겼다.

## 목적

같은 사진, 같은 5개 장면 조건, 같은 반복 횟수로 방식별 삽화를 만들어 한 리포트에서 나란히 비교한다. 얼굴이 달라지는 조건과 재생성이 필요한 경우를 근거와 함께 설명하고, 기준선은 "원래 그대로"(B0)와 "결함 수정본"(B1)으로 나눠 결함 때문에 진 것인지 방식 때문에 진 것인지 가린다. Seedream과 영상 생성은 다루지 않는다.

## 비교군

| 비교군 | 방식 | 참조 | 반복 |
| --- | --- | --- | --- |
| B0 | 기준선 원래 그대로(모든 CLIPTextEncode에 프롬프트, 시드 608548260914332) | 사진 | 1회(결정적) |
| B1 | 기준선 결함 수정본(부정 프롬프트 보존, 장마다 무작위 시드 기록) | 사진 | R회 |
| G1 | GPT Image | 사진만 | R회 |
| G2 | GPT Image | 승인 캐릭터만 | R회 |
| G3 | GPT Image | 승인 캐릭터 + 사진(캐릭터를 먼저) | R회 |

## 조건 5개

id와 장면 문장, 순서는 고정이다. `caption_ko`는 검토 화면에 보여 줄 한국어 장면 설명이다.

| 순서 | id | 장면 문장 | caption_ko |
| --- | --- | --- | --- |
| 1 | `front` | The character stands in a sunny forest clearing, facing the viewer directly, with a gentle smile. Upper body and face clearly visible. | 햇살 드는 숲속 빈터에서 정면을 보고 미소 짓는 모습 |
| 2 | `side` | The character walks along a riverside path, seen in full side profile facing left, looking ahead. | 강가 길을 걷는 옆모습 |
| 3 | `expression` | The character laughs out loud with eyes squeezed shut and mouth wide open, holding a red balloon at a village festival. | 마을 축제에서 빨간 풍선을 들고 눈을 감은 채 크게 웃는 모습 |
| 4 | `full_body` | The character jumps over a puddle on a rainy street. Full body visible from head to shoes. | 비 오는 거리에서 웅덩이를 뛰어넘는 전신 모습 |
| 5 | `outfit` | The character stands under a big umbrella wearing a yellow raincoat and green rain boots instead of the usual outfit. | 큰 우산 아래 노란 비옷과 초록 장화 차림(평소 옷과 다름) |

## 프롬프트 틀

GPT Image 장면 프롬프트 틀(`{}`는 치환):

```text
Create exactly one children's storybook illustration. Use the image generation tool exactly once.
Scene: {scene}
Character identity: the main character is the same person as in the reference image(s). Keep the face shape, eyes, eyebrows, nose, mouth, skin tone, hairstyle and hair color. Keep the apparent age. {char_look}
Outfit: {outfit_rule}
Style: soft, warm storybook illustration, consistent with the reference character image when one is given. One character only. No text, no watermark, no border. Portrait orientation.
Permission: the person shown in the reference image(s), or their guardian, has agreed to this use of their likeness.
Reference images (pass every path in referenced_image_paths):
{reference_lines}
Do not run shell commands. Do not edit files. When the tool returns, answer with JSON only.
```

`{reference_lines}`는 한 줄에 `<절대 경로> - <역할>` 형식이고 역할은 `approved storybook character (identity and style source)` 또는 `photo of the real person (identity source)`다. `{outfit_rule}`은 조건 `outfit`과 장면 글이 옷을 명시한 경우 `as described in the scene`, 그 외에는 참조에 승인 캐릭터가 있으면 `the same outfit as the reference character`, 없으면(사진만 참조) `the outfit given in the character identity line`이다. 최종 메시지 스키마는 `{"status":"generated|modified|declined|failed","note":"string"}`.

기준 캐릭터 프롬프트:

```text
Create exactly one storybook-style character portrait of the person in the reference photo. Use the image generation tool exactly once.
Keep the face shape, eyes, eyebrows, nose, mouth, skin tone, hairstyle, hair color and apparent age so that the person stays recognizable. Waist-up, facing the viewer, relaxed friendly expression, plain light background, wearing a plain single-color T-shirt.
Style: soft, warm children's storybook illustration. One character only. No text, no watermark, no border. Portrait orientation.
Permission: the person shown in the reference photo, or their guardian, has agreed to this use of their likeness.
Reference images (pass every path in referenced_image_paths):
{photo_path} - photo of the real person (identity source)
Do not run shell commands. Do not edit files. When the tool returns, answer with JSON only.
```

특징 문장(charLook)은 승인 캐릭터와 사진을 함께 넣은 글 작업으로 만든다. 지시문은 `backend-fastAPI/app/service/getImgPromptService.py:7-20`의 developer 문구를 옮기되, 출력은 `{"charLook":"<영어 한두 문장, 300자 이내, 'A ... with ...' 다음 'Wearing ...'>"}`로 받는다.

기준선 프롬프트는 두 비교군 모두 `{scene} {char_look}`(공백 하나로 연결)이다. 기존 서비스가 장면 프롬프트 뒤에 charLook을 붙이던 형식(`backend-fastAPI/app/service/onBackground.py`)과 같다.

## 순서, 반복, 한도

순서는 1회차에 기준 캐릭터, G2(파일럿), G1, G3, B1, B0이고 2회차부터는 G2, G1, G3, B1이다. 각 비교군 안에서는 조건 순서를 따른다.

반복과 한도 규칙: 파일럿(기준 캐릭터 1장 + G2 1회차 5장) 뒤에 `per_image = max((파일럿 뒤 used_percent - 파일럿 앞 used_percent) / 성공 장수, 0.2)`를 구한다. `R`은 `(15 * r + 1) * per_image <= 40`을 만족하는 3, 2, 1 중 가장 큰 값이고, 없으면 1이다. GPT 작업 전에 실험 누적 소진량이 40 이상이거나 `최신 used_percent >= 95`이면 멈추고 종료 코드 20을 낸다. 누적 소진량은 한도 창(`resets_at`)별 증가분의 합이다. 창이 바뀌면(주간 초기화) 새 창에서 처음 읽은 값을 시작값으로 삼아 이어서 더하고, `plan.json`의 `windows: [{resets_at, start, last}]`에 남긴다. 데모 실제 QA(할 일 31)의 상한은 10이다.

JSON의 `caps`는 `{"lab": 40, "demo": 10}`이다.

## 평가 척도

과제 유형은 `resemblance`(사진 1장 대 그림 1장, 기준 캐릭터 포함)와 `consistency`(한 비교군 한 회차의 5장 묶음)다. 과제 ID는 `sha256(blind_secret + 키)`의 앞 12자리이고, 응답과 이미지 주소에 비교군과 회차가 드러나면 안 된다. 과제에는 그림마다 장면 설명(`caption_ko`)을 함께 보여 준다(옷이 바뀌는 조건인지, 장면이 맞는지를 검토자가 판단할 수 있어야 한다). 과제 순서는 검토자 이름을 시드로 섞는다. 검토자는 3명이고 블라인드로 평가한다.

- 닮음 척도: 5 누가 봐도 같은 사람, 4 닮았다, 3 애매하다, 2 닮지 않았다, 1 전혀 다른 사람.
- 일관성 척도: 5 모든 장면이 같은 캐릭터, 4 사소한 차이, 3 한 장면이 다른 사람 같다, 2 여러 장면이 다르다, 1 장면마다 다른 사람.
- 그림 과제에는 "책에 쓸 수 있나"(예/아니오)와 실패 유형 태그(복수 선택): `different_person`, `age_drift`, `hair_drift`, `outfit_drift`, `style_break`, `artifact`, `wrong_scene`, `other`.
- 검토 기록 한 줄: `{"reviewer","taskId","key","type","score","usable","tags","at"}`. 같은 검토자와 과제의 마지막 기록이 유효하다.

## 통과와 선정 규칙

- 통과 규칙(비교군별): 닮음 평균 4.0 이상, 일관성 평균 4.0 이상, 닮음에서 2점 이하 비율 10% 이하, 일관성에서 2점 이하 비율 10% 이하를 모두 만족.
- 선정 규칙: 통과한 비교군 중 닮음 평균이 가장 높은 것. 차이가 0.1 미만이면 일관성 평균, 그다음 장당 한도 소진량이 적은 것, 그다음 지연 중앙값이 짧은 것. 통과한 것이 없으면 "통과한 방식 없음"과 닮음 평균 최고 비교군, 조건별 미달 목록을 낸다. 검토자 3명이 모든 과제를 끝내기 전에는 결론을 내지 않고 `검토 대기 (완료 n/3)`로 표시하며, 중간 집계는 참고로만 보여 준다.

JSON의 `pass`는 `{"mean_min":4.0,"low_score_max":2,"low_rate_max":0.10}`이다.

## 한계

- 화풍으로 방식이 드러난다. 기준선(toonyou)과 GPT Image는 그림체가 달라서, 과제 ID와 주소를 숨겨도 검토자가 방식을 짐작할 수 있다.
- 사진은 1장이다. 결과는 한 사람, 한 장의 사진에 대한 것이고 일반화하지 않는다.
- 테스트 사진은 성인 증명사진이다. 실제 사용자인 아이의 사진과는 다르게 나올 수 있다.
- B0는 결정적이다. 시드가 고정이라 1회만 돌리고, 반복에 따른 흔들림은 B1에서만 본다.

## 재현성

이 실험에서 재현성은 같은 결과를 다시 얻는다는 뜻이 아니다. GPT Image는 같은 요청에도 결과가 달라지므로, 생성마다 요청 전문, 참조 이미지 해시, CLI 버전, thread_id, 결과물을 저장해 무엇을 어떻게 요청했는지 다시 확인할 수 있게 한다. 결과의 흔들림은 반복 회차 중 통과하거나 쓸 수 있는 결과의 비율(반복 비율)로 보고한다.
