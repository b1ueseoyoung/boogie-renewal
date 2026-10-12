# Design — 꿈도깨비

모든 화면이 따르는 디자인 규칙. 화면을 고칠 때 이 파일을 먼저 읽고, 값은 `frontend/src/styles/theme.js` 토큰으로만 쓴다(화면 파일에 색·글꼴·rgba·굵기 숫자를 직접 적지 않는다. 필요한 값은 theme에 토큰으로 더한다).

## Genre
깔끔한 앱(A안) — 토스 같은 요즘 한국 앱. 7~9세 아이와 옆의 보호자가 함께 본다. 밝은 회백 바탕 위 흰 카드, 가는 테두리, Pretendard 하나와 굵기 위계, 둥근 사각 버튼. 받침(턱)·종이 결·손글씨체는 쓰지 않는다. 귀여움은 도깨비 그림이 맡는다. 데스크톱(1280px)과 휴대폰(390px)이 같은 모양이다.

## Macrostructure family
- 앱 화면(만들기 흐름, 로그인·가입): 한 화면에 한 가지 일. 큰 제목 → 그림 → 행동 버튼. 흰 카드(가는 테두리). `BaseScreenLayout`. 메뉴 막대가 없으니 막대 자리를 비우지 않는다(`nav` 기본값 false).
- 목록 화면(책장, 즐겨찾기, 내 캐릭터, 책장 편집, 부모 리포트, 설정): 바탕 위에 큰 제목 + 책 격자. `PageShell` + `PageHeader` + `ShelfGrid`. 막대가 없는 경로(책장 편집, 부모 리포트)는 `<PageShell $nav={false}>`.
- 이야기 화면(진행, 읽기): 카드 없이 바탕 위에 펼친 책. 그림이 주인공이고 글은 책처럼 크게.
- 홈: 카드 없는 큰 첫 화면(제목 + 도깨비) + 최근에 만든 책 한 줄.

## Theme
| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `bg` | `#F4F6FA` | 바탕(밝은 회백 단색) |
| `surface` / `surface2` | `#FFFFFF` / `#F2F4F6` | 카드·막대·입력칸 / 보조 면, 그림 자리, hover |
| `rule` / `line` / `lineStrong` | `#EEF0F3` / `#E5E8EB` / `#D1D6DB` | 구분선 / 카드·칩·보조 버튼 테두리 / 입력칸 테두리, 남은 진행 점 |
| `ink` / `inkSoft` / `inkMuted` | `#191F28` / `#4E5968` / `#6B7684` | 글자 / 부제·보조 글 / 캡션·자리표시(흰 바탕 위에서만) |
| `accent` / `accentHover` / `accentDeep` | `#2F5BFF` / `#2449E0` / `#1B3BD1` | 주요 버튼·링크·포커스 / 주요 버튼 hover / 누름, 옅은 파랑 위 글자 |
| `accentPale` / `accentTrack` / `accentInk` | `#EAF0FF` / `#D6E0FF` / `#FFFFFF` | 선택·활성·배지·도깨비 뒤 원 / 지난 진행 점, 스피너 고리 / 파랑·빨강 위 글자 |
| `redpen` / `redpenHover` / `redpenDeep` / `redpenPale` | `#CC2E2E` / `#B32424` / `#8F1D1D` / `#FDECEC` | 오류·위험 동작 / hover / 누름 / 오류 배지 바탕 |
| `sun` / `sunPale` / `sunDeep` | `#FFB020` / `#FFF4D6` / `#B87700` | 즐겨찾기 별과 아주 작은 장식만 |
| `pencil` | `#C4CAD2` | 빈 자리 점선(장식) |
| `scrim` / `scrimSoft` | ink 48% / 32% | 막 |
| `chart` | 파랑 중심 8색 | 차트 조각. 원형 차트의 마지막 조각은 첫 조각(파랑)과 맞닿으므로 조각 수와 상관없이 이웃끼리 명도나 색상이 다르다(ΔE2000 12 이상). 모두 흰 바탕 3:1 이상 |

대비: ink/흰 16.6:1, inkSoft/흰 7.1:1(바탕 6.6:1), inkMuted/흰 4.62:1(바탕 4.27:1이라 바탕 위 작은 글자는 inkSoft), 흰 글자/accent 5.17:1, accentDeep/accentPale 7.1:1, 흰 글자/redpen 5.25:1.

그 밖의 토큰: `weight`, `tracking`, `text`, `radius`, `border`, `shadow`, `motion`, `tap`(44px), `layout`(navH 4rem·navHWide 4.5rem, 페이지 폭 74rem, gutter), `mq`(wide·narrow·phone·hover), `z`.

화면이 바뀌는 지점은 `mq.wide`(56rem) 하나다. 화면 파일에 `min-width` 숫자를 따로 적지 않는다.

## Typography
- 글꼴은 Pretendard 하나(`fonts.display` = `fonts.body`, jsdelivr 1.3.9). 대체: -apple-system, Apple SD Gothic Neo, Malgun Gothic.
- **굵기로 위계.** `weight` regular 400 / medium 500 / semibold 600 / bold 700(heavy 800은 로고 글자만). 화면·섹션 제목 bold(대화상자·안내 제목 포함), 버튼·라벨·칩·카드 제목 semibold(설정 카드, 차트 카드처럼 카드 안의 h2도), 본문 regular, 캡션 regular 또는 medium. `font-synthesis: none`(실제 굵기만 쓴다).
- 글자 간격: 제목 `tracking.tight`(-0.02em), 본문 `tracking.body`(-0.01em). 버튼·입력칸도 본문 간격을 이어받는다(GlobalStyle의 `letter-spacing: inherit`).
- 크기: `text` xs 12 · caption 13 · sm 14 · md 15 · base 16 · lg 18 · xl 22px, 2xl·3xl·hero는 clamp. 이야기 글 `text.story`는 390px 18px, 1280px 22px.

## Shape and depth
- 모서리: 카드 1rem, 대화상자 1.25rem, 표지·삽화 0.75rem, 버튼 0.875rem(sm 0.75rem), 입력칸 0.75rem, 배지 0.5rem, 판(`PaperFrame`)이나 썸네일 버튼 안에 겹친 그림 0.5rem(`radius.inner`), 칩·진행 점·메뉴 알약만 999px.
- 테두리는 모두 1px: `border.card`(line), `border.input`(lineStrong), `border.rule`(rule).
- 카드는 그림자 없이 테두리로 나눈다(`shadow.card` none). 막 위의 대화상자만 `shadow.dialog`, 누를 수 있는 카드에 올리면 `shadow.cardHover`. 받침(ledge)은 없다.
- 크기를 바꾸지 않고 1px 테두리만 보여야 하는 곳은 `shadow.ring`(바깥 1px line).
- 펼친 책(이야기 진행·읽기 화면): 흰 면 + `radius.card` + `shadow.ring`. 가운데 접힌 곳만 `shadow.gutter`로 옅은 그늘을 둔다.
- 고르는 그림 카드는 한 가지 선택 표시: 옅은 파랑 바탕(카드가 있으면) + 파란 고리 `pickedRing` + 오른쪽 위 체크 원 `PickCheck`. 여러 개를 고르는 곳은 고르지 않은 칸에 빈 원.
- 표지가 없는 책, 그림이 없는 캐릭터는 `cover-placeholder.svg`(회백 면 + 옅은 파랑 원 + 펼친 책).

## Motion
- 화면·장면이 나타날 때 아래에서 떠오름(360ms, ease-out, `rise`). 선택지는 70ms씩 차례로. 막은 서서히(`fadeIn`).
- 버튼: 올려도 뜨지 않고 바탕만 바뀐다. 누르면 `motion.pressScale`(0.98)로 살짝 작아지고 바탕이 조금 진해진다. 비활성은 반응하지 않는다. hover 모양은 `mq.hover` 기기에서만.
- 메뉴 탭(`BottomNav`)과 그림 위의 보이지 않는 버튼(홈의 방망이)은 누름 반응도 끈다. 전역 규칙보다 우선하려면 `&&&:active { scale: none; }`처럼 클래스를 세 번 적는다.
- `prefers-reduced-motion`이면 모두 끈다(지연도 없앤다. 대기 도깨비는 멈춘 그림 한 장).
- 불러오는 동안의 빈 자리는 `Skeleton`(rule ↔ line, 1.4초 깜빡임) 하나만 쓴다.

## CTA voice
- 주요: 파랑 바탕 + 흰 글자, hover accentHover, 누름 accentDeep. 높이 52px, 1rem semibold. `<RoundedButton $primary>`
- 보조: 흰 바탕 + 1px line 테두리 + ink 글자, hover surface2. `<RoundedButton>`
- 조용한 버튼: 투명 바탕 + inkSoft 글자, hover surface2. `<RoundedButton $quiet>`
- 위험(삭제·탈퇴): 빨강 바탕 + 흰 글자. `<RoundedButton $danger>`
- 낮은 버튼 `$size="sm"`(44px, 15px 글자), 가로 줄에 놓는 버튼 `$inline`. 글자 같은 보조 길은 `TextButton`(파란 semibold).
- 비활성은 surface2 바탕 + inkMuted 글자(`Chip`·`ChoiceButton`도 같고, `TextButton`은 inkMuted 글자만). 누르던 버튼이 비활성이 되는 자리(읽기 화면의 처음·끝 쪽)는 `disabled` 대신 `aria-disabled="true"`.
- 대화상자의 버튼은 폭을 다 쓰고 주요 → 보조 순서로 세로로 쌓는다. 버튼으로만 닫아야 하는 대화상자(이야기 끝)는 `onClose`를 넘기지 않는다.

## Words
- 진행 표시는 "2 / 3" 한 형식. 이야기 장은 "2장 / 5장". 화면에서 글자를 쓰지 않고 `progressCurrent`·`progressTotal`(·`progressUnit="장"`)만 넘긴다.
- 제목이 빈 책은 어디서나 `UNTITLED`('제목 없는 동화').
- 불러오기 실패는 `LoadError`(경고 배지 카드), 정말 비어 있을 때만 `Empty`(갸웃하는 도깨비).

## Components (frontend/src/components)
| 부품 | 모양 |
| --- | --- |
| `Card` (`$pad`), `Overlay`, `DialogCard` | 흰 카드 + 1px line, 그림자 없음 / 막 / 막 위 카드(테두리 없이 1.25rem + `shadow.dialog`) |
| `Dialog`, `PopCard` | 대화상자(포커스 가두기, Escape, `media`·`actions`) / 화면이 그린 막 위의 작은 카드(새 화면은 `Dialog`) |
| `RoundedButton`, `TextButton`, `Chip` | 둥근 사각 버튼 / 글자 버튼 / 알약 칩(기본 흰 바탕 + line, 고르면 accentPale + accent 테두리 + accentDeep) |
| `FormField` | 52px 입력칸, 1px lineStrong, 포커스 accent 테두리 + 3px accentPale 고리, 오류 redpen 테두리 + 14px 오류 글. 라벨 15px semibold |
| `ChoiceButton` | 흰 카드 + 1px line + 0.875rem, 번호 원 accentPale + accentDeep bold, hover 테두리 accent, 고르면 accentPale 바탕 |
| `PageShell`, `PageHeader`, `ShelfGrid` | 목록 틀 / 큰 bold 제목(eyebrow는 accentPale 배지 13px semibold) / 책 격자(390px 2칸, 1280px 5칸) |
| `BaseScreenLayout`, `PaperFrame`, `SunDisc`, `StepDots` | 흐름 카드 / surface2 그림 판 / 도깨비 뒤 accentPale 원 / 진행 점(지금 accent 알약, 지난 accentTrack, 남은 lineStrong) |
| `Block`, `FavoriteButton` | 책·캐릭터 카드(3:4 표지 + 1px line, 15px semibold 제목, 13px 날짜) / 표지 위 별(켜면 sunPale + sunDeep) |
| `Empty`, `WaitingOverlay`, `GenerationError` | 빈 상태 / 대기(움직이는 도깨비 + 파란 점) / 흐름의 오류(막 위 카드) |
| `WarnBadge`, `LoadError` (`Notice.jsx`) | redpenPale 원 + redpen 세모 / 화면 안 불러오기 실패 카드 |
| `PickCheck`, `pickedRing` (`Pick.jsx`) | 체크 원 / 고른 고리 |
| `BottomNav`, `Wordmark` | 흰 막대 + 1px line(데스크톱 위, 휴대폰 아래 탭. 활성 accent·accentPale 알약) / 로고(마크 + '꿈도깨비' 800, 아래 '로고') |
| `NoteBox` (`Card.jsx`), `Skeleton` | 짧은 안내(accentPale) / 불러오는 자리 |
| `CoverImg`, `coverPlaceholder`, `CoverPlate`, `UNTITLED` | 표지 그림(없으면 대체 그림) / 대화상자의 표지 판 / 제목 없는 책 이름 |

도깨비와 '꿈도깨비' 이름은 대기·빈 상태·로그인 같은 순간에 나온다(이미 있는 `assets/images` 그림과 `assets/brand` 로고만 쓴다).

## Logo
- 마크: `frontend/src/assets/brand/logo-mark.svg`. 파란(accent) 둥근 사각 배지 안의 도깨비 얼굴(노란 얼굴, 크림 뿔, 갈색 앞머리·눈썹, 반짝이는 큰 눈, 작은 입). 6색 면만 쓰고 그라데이션·그림자·선이 없다. 늘이거나 돌리거나 색을 바꾸지 않는다.
- 가로형 로고는 `Wordmark` 하나만 쓴다: 마크(글자의 1.4배) + 마크 폭 0.2 간격 + Pretendard `weight.heavy`(800) '꿈'(ink) '도깨비'(accent), `tracking.logo`(-0.03em). 크기는 font-size로만 바꾼다(메뉴 막대·홈 22px, 로그인·가입 카드 text.2xl). 마크는 꾸밈(alt="")이고 이름은 글자로 남긴다.
- 최소 크기: 마크 16px(파비콘), 가로형 로고는 글자 14px(마크 약 20px) 이상. 16px 자리는 디테일을 줄인 `public/favicon.svg`를 쓴다(뿔 점·작은 반짝임·앞머리 가닥을 빼고 얼굴을 키움). 홈 화면 아이콘은 `public/apple-touch-icon.png`(180px, 파란 정사각형을 꽉 채움).
- 여백: 마크 둘레에 마크 폭의 1/4 이상 비운다(SVG 안에 이미 1/16 여백이 있다). 마크 옆이나 위에 도깨비 그림을 또 붙이지 않는다(로고 하나만).
- 바탕: 흰색·`bg`·`accentPale` 위에서는 그대로. 어두운 바탕(ink `#191F28`) 위에서는 마크는 그대로, 글자는 '꿈' 흰색 + '도깨비' accent(22px 800 큰 글자 기준 3.2:1). 파랑(accent) 바탕 위에는 배지가 묻히므로 가로형 로고를 두지 않는다. 사진·삽화 위에는 흰 판을 깔고 둔다.

## What pages MUST share
글꼴 하나와 굵기 단계, 색 토큰, 버튼 모양, 카드 모양(1px 테두리), 진행 표시(점), 대화상자, 빈 상태, 터치 크기 44px(`theme.tap`) 이상, 포커스 고리.

## What pages MAY differ on
화면 구조(카드 / 목록 / 펼친 책 / 큰 첫 화면), 그림 크기.
