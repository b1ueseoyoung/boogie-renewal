# 적용 디자인 방향: 방향 C 알림장 노트

고른 방향은 `.omo/ulw-execute/design-decision.json`의 `direction: "c"`다(시안 `docs/design/mockups/c/index.html`, 토큰 `docs/design/mockups/c/tokens.css`, 설명 `docs/design/directions.md`). 사용자가 2026-10-04에 골랐고, 할 일 39가 할 일 37(토대)과 26~28(화면)이 먼저 입힌 방향 A를 이 방향으로 다시 맞췄다. 줄 그은 노트에 또박또박 적어 둔 알림장: 그림자 없이 테두리로만 칸을 나누고, 글꼴은 하나(IBM Plex Sans KR)이며, 화면 제목과 진행 상황을 머리줄 한 줄에 적어 옆에서 보는 보호자도 지금 어디까지 왔는지 한눈에 안다.

## 토큰 (`frontend/src/styles/theme.js`)

`App.js`가 styled-components의 `ThemeProvider`로 화면 전체를 감싸므로 모든 styled 컴포넌트에서 `${({ theme }) => theme.colors.accent}`처럼 읽는다. 색 값과 글꼴 이름을 화면 파일에 직접 적지 않는다(`grep -nE "#[0-9a-fA-F]{3,8}\b" screens/*.js screens/*.jsx components/*.js components/*.jsx`가 0이어야 한다). 값은 `tokens.css`와 같다.

| theme 키 | tokens.css | 값 | 쓰는 곳 |
| --- | --- | --- | --- |
| `colors.bg` / `colors.rule` | `--c-bg` / `--c-rule` | `#fcfcfa` / `#d7dbe4` | 노트 종이 바탕(GlobalStyle이 노트 줄과 함께 깐다) / 노트 줄과 가는 테두리 |
| `colors.surface` / `colors.surface2` | `--c-surface` / `--c-surface-2` | `#ffffff` / `#f1f3f7` | 흰 칸(화면 칸, 버튼, 사진 틀, 선택지, 썸네일) / 보조 면(펼친 책의 그림 쪽, 진행 막대 바닥, 오류 카드 바탕, 버튼 hover) |
| `colors.ink` / `colors.inkSoft` | `--c-ink` / `--c-ink-soft` | `#20262e` / `#5b6672` | 글자와 굵은 테두리 / 보조 글자(부제, 진행 상황, 캡션) |
| `colors.accent` / `accentPale` / `accentInk` / `accentDeep` | `--c-accent` / `-pale` / `-ink` / `-deep` | `#2f5bff` / `#e3e9ff` / `#ffffff` / `#1b3bd1` | 주요 버튼, 링크, 강조 글자, 포커스·선택 상태 / 옅은 배경(선택 상태, 동의 안내, 대기 상자, 선택지 hover) / 파란 버튼 글자 / hover |
| `colors.redpen` / `colors.pencil` | `--c-redpen` / `--c-pencil` | `#c62d20` / `#8b93a1` | 선생님 빨간펜(오류 카드의 왼쪽 여백선과 아이콘) / 연필심(빈 사진 자리·빈 책장의 점선) |
| `colors.accentTrack` | `--c-accent-track` | `#c3d0ff` | 스피너 바닥 고리 |
| `colors.scrim` | (React에서 더함) | `rgba(32, 38, 46, 0.6)` | 오버레이(대기, 오류, 대화 상자) 뒤 막 |
| `fonts.display` = `fonts.body` | `--font-display` = `--font-body` | IBM Plex Sans KR (+ Apple SD Gothic Neo, Malgun Gothic) | 글꼴 하나로 전부. 위계는 굵기(제목 700, 버튼·캡션 600, 선택지 500)로 준다. `public/index.html`이 Google Fonts에서 400·500·600·700을 불러온다 |
| `text.xs … text.xl` | `--text-xs … --text-xl` | 12 / 14 / 16 / 18 / 22px | 보조 글, 진행 상황, 본문·버튼, 대기 글, 질문 |
| `text['2xl']` / `text['3xl']` / `text.story` | `--text-2xl` / `--text-3xl` / `--text-story` | clamp | 머리줄 화면 제목 / 큰 제목 / 이야기 글(390px 18px, 1280px 21px) |
| `leading.tight` / `leading.body` | `--leading-*` | 1.3 / 1.7 | 제목 / 본문 |
| `space[1] … space[8]` | `--space-1 … 8` | 0.25 / 0.5 / 0.75 / 1 / 1.25 / 1.75 / 2.5 / 3.5rem | 모든 간격. `theme.space[4]`처럼 숫자 키 |
| `radius.card` / `radius.btn` / `radius.tag` | `--radius-*` | 0.375 / 0.375 / 0.1875rem | 칸·틀 / 버튼 / 꼬리표(번호 칩, 체크, 진행 막대, 그림 모서리) |
| `border.thick` / `border.rule` | `--border` / `--border-rule` | 2px solid ink / 1px solid rule | 화면 칸, 머리줄 밑줄, 버튼, 펼친 책, 대화 상자 / 사진 틀, 썸네일, 선택지, 진행 막대 |
| (그림자 없음) | `--shadow-none` | `none` | 그림자 키는 두지 않는다. 면은 테두리로만 나눈다 |
| `motion.fast` / `motion.base` / `motion.ease` | `--dur-fast` / `--dur` / `--ease` | 100ms / 160ms / cubic-bezier | 색 전환(위치가 움직이는 효과는 쓰지 않는다) |
| `tap` | `--tap` | 2.75rem(44px) | 버튼·선택지·탭의 최소 높이 |
| `legacy.*` | (없음) | 이전 색 그대로 | 흐름 밖 화면(로그인, 회원가입, 결과, 책장 편집, 부모 리포트 차트)이 쓰던 색. 이번에 다시 입히지 않은 화면이라 값만 theme로 옮겼다. 새 화면에서는 쓰지 않는다 |

시안 C의 걱정거리 두 가지는 이렇게 다뤘다. (1) 이야기 글은 390px에서 `text.story`가 18px로 기준에 딱 맞는다. 할 일 39가 390px에서 `getComputedStyle`로 재서 18px 이상임을 확인했고, 모자라면 `text.story`를 한 단계 키운다. (2) 그림자가 없어 위계가 평평해지는 것은 굵은 테두리(화면 칸, 머리줄 밑줄)와 굵기로 보완하고, 승인 화면의 원본 사진과 후보는 흰 칸(`surface` + `border.rule`) 위에 기울기 없이 나란히 두어 닮음 판단에 방해가 없게 했다.

## 전역 (`frontend/src/styles/GlobalStyle.js`)

바탕색 `colors.bg`과 노트 줄(1.75rem마다 `colors.rule` 1px), 기본 글꼴(`fonts.body`, `text.base`, `leading.body`), `word-break: keep-all`, `h1~h3`는 `fonts.display` 700에 `leading.tight`, 링크는 `colors.accent`, `:focus-visible`은 강조색 3px 외곽선(offset 2px), `prefers-reduced-motion: reduce`에서 모든 animation·transition을 0.01ms로 줄인다. 화면마다 다시 적지 않는다.

## 컴포넌트 쓰는 법 (`frontend/src/components/`)

**화면 틀 `BaseScreenLayout`** — 노트 바탕 위 흰 칸 한 장(`border.thick`, 그림자 없음). 맨 위에 알림장 머리줄이 있다: 왼쪽에 화면 제목, 오른쪽에 진행 상황(단계 글과 진행 막대)을 한 줄에 적고 `border.thick` 밑줄을 긋는다. props: `progressText`(진행 상황 글, 예 `"2/3"`), `progressCurrent`·`progressTotal`(진행 막대, `role="progressbar"`), `title`(화면 제목, `\n` 줄바꿈 가능), `subTitle`(보조 글. 문자열이나 노드), `children`(본문), `aside`(사진·삽화 자리에 넣을 노드), `imageSrc`·`imageAlt`·`imageWidth`(aside가 없을 때 이미지를 `PaperFrame`에 넣어 준다), `imageFill`(투명 바탕 그림 뒤에 깔 `theme.colors` 키. 이름 입력 화면의 흰 실루엣이 흰 틀에 묻히지 않게 `inkSoft`를 쓴다. 틀 자체는 흰 칸 그대로다). 52rem 이상에서는 aside가 왼쪽 열, 부제와 본문이 오른쪽 열이고 그 아래 폭에서는 머리줄 → 부제 → 본문 → aside 순서로 한 열이다. 같은 파일이 `PaperFrame`을 export한다: 시안 `.figure`처럼 흰 칸 + `border.rule` + `radius.card`(`$maxWidth` 기본 20rem). 기울기와 테이프는 없다. 사진·삽화·Lottie는 이 틀 안에 `<img>`나 `<svg>`로 넣는다(`display:block; width:100%`).

**버튼 `RoundedButton`** — `styled.button`. 기본은 보조(흰 칸, `border.thick`, hover에 `surface2`). `$primary`면 주요(강조색 바탕과 테두리, 흰 글자, hover는 `accentDeep`). `$quiet`면 `border.rule`의 조용한 버튼("다른 인물로 바꿀래요." 같은 세 번째 선택, `inkSoft` 500). `disabled`면 흐리게(opacity 0.45). 높이 44px 이상, 16px 600, 폭 100%(최대 35rem), 연이어 놓으면 0.75rem 간격이 자동으로 들어간다. 한 화면에 주요 버튼은 하나다.

**선택지 `ChoiceButton`** — `text`, `imageSrc`, `onClick`. 그림 위에 흰 라벨 띠(`border.rule`), hover에 라벨이 `accentPale`. 글만 있는 선택지(이야기 진행)는 시안 `.choice`대로 만든다: 흰 칸, `border.rule`, `radius.card`, 왼쪽에 먹색 테두리 번호 칩(1.625rem, `border.thick`, `radius.tag`), hover에 `accentPale`.

**사진 올리기 `GallerySelectButton`** — `label`, `onClick`, `isFinished`. 연필심(`pencil`) 점선 드롭존(흰 바탕, 카메라 아이콘) 안에 주요 버튼이 들어 있다. 끝나면 아이콘 자리에 완료 Lottie.

**대기 오버레이 `WaitingOverlay`** — `message`(필수, 예 `"도깨비가 다음 장면을 그리고 있어요"`), `elapsed`(초 단위 숫자. 있으면 `"12초 지났어요"` 줄을 보여 준다). 화면 전체를 `scrim`으로 덮고 가운데에 `accentPale` 상자(`border.thick`, 스피너 + 글)를 놓는다. `role="status"`, `aria-live="polite"`. 생성을 기다리는 동안 띄우고 응답이 오면 내린다. 사진 올리기 화면은 `message="사진을 올리고 있어요"`로 쓴다.

**오류 카드 `GenerationError`** — `error`(C-2 본문: `errorClass`, `message`, `retryable`, `resetsAt`), `onRetry`. `scrim` 위에 시안 `.errorcard`: `surface2` 바탕, `border.thick`, 왼쪽에 빨간펜(`redpen`) 6px 여백선, 빨간펜 경고 아이콘, 문구. 문구 규칙: `limit`이면 초기화 시각을 넣은 limit 문구(시각과 "이후에"는 줄바꿈 없이), `error`이고 서버가 `message`를 줬으면 그 문구(예 413 "사진이 너무 커요. 10MB 이하로 올려 주세요.", 415 "이미지 파일만 올릴 수 있어요."), 그 밖에는 C-2의 기본 문구. "다시 시도해 볼까요?"는 한 줄로 묶는다. `retryable`이면 "다시 시도" 보조 버튼이 붙는다. `role="alert"`.

**머리줄 `Header`**(`pageName`)와 **하단 탭 `BottomNav`** — 흰 머리줄(`border.thick` 밑줄)과 흰 탭 바(`border.thick` 윗줄). 현재 탭은 강조색, 나머지는 `inkSoft`. 탭은 `button`이고 `aria-current="page"`.

**`PopCard`** — 흐름 밖 화면(책장 편집, 즐겨찾기 등)이 쓰므로 크기와 구조는 그대로고 색(`surface`, `ink`, `accent`, `redpen`), 테두리(`border.thick`), 모서리(`radius.card`, `radius.btn`)만 토큰이다. 새 화면에서는 쓰지 말고 위 컴포넌트를 쓴다.

## 할 일 26~28 화면의 시안 대응표

- 승인 화면: 머리줄에 "○○! 이렇게 생겼군요!"와 "3/3". 원본 사진과 고른 후보를 `PaperFrame` 두 개로 나란히(`repeat(auto-fit, minmax(min(15rem, 100%), 20rem))`, 가운데 정렬, 기울기 없음). 후보 썸네일은 흰 칸 + `border.rule`, 고른 것은 `accentPale` 바탕과 오른쪽 위 강조색 네모 체크(`radius.tag`, `aria-pressed`). 버튼 줄: 주요 "이 캐릭터로 할래요", 보조 "다시 만들기 (n/3)", `$quiet` "다른 인물로 바꿀래요.".
- 이야기 진행: 머리줄에 "2 / 5"와 진행 막대, 삽화는 `PaperFrame`, 이야기 글은 `text.story`·`leading.body`, 질문은 `text.xl` 700에 먹색 4px 왼쪽 줄(시안 `.question`), 선택지는 위 `.choice` 규칙. 기다릴 때 `WaitingOverlay`, 실패하면 `GenerationError`.
- 읽기: 머리줄에 동화 제목. 펼친 책은 `border.thick` + `radius.card`의 2쪽(그림 쪽 `surface2`, 글 쪽 `surface`에 왼쪽 `border.thick`), 쪽 내용은 안쪽 칸이 세로·가로 가운데에 놓는다(react-pageflip이 쪽 요소의 display를 덮어쓰기 때문). 글은 `text.story` 가운데 정렬 최대 26ch. 아래에 진행 막대(`surface2` 바닥, 강조색 채움)와 "이전 장으로" / 읽어주기(강조색 둥근 44px 버튼) / "다음 장으로".
- 책장: 흰 머리줄 "내 책장", 주인공 거르기 칩(흰 칸 + `border.rule`, 고른 것 `accentPale`), 책 한 권은 `PaperFrame` + 제목 600, 비어 있으면 연필심 점선 안내 상자.
