// 깔끔한 앱 방향(A안). 밝은 회백 바탕 위 흰 카드, 카드는 그림자 대신 가는 테두리로 나눈다.
// 바탕은 밝은 색 하나만 쓴다(운영체제 다크 모드 전환은 이번 범위가 아니다).
// 글꼴은 Pretendard 하나. 위계는 굵기(weight), text 크기, ink/inkSoft/inkMuted 색으로 만든다.
// 받침(턱)·종이 결·손글씨체는 쓰지 않는다.

const colors = {
  bg: '#F4F6FA', // 바탕 (밝은 회백)
  surface: '#FFFFFF', // 카드·막대·입력칸
  surface2: '#F2F4F6', // 보조 면, 그림 자리, hover
  rule: '#EEF0F3', // 구분선
  line: '#E5E8EB', // 카드·칩·보조 버튼 테두리
  lineStrong: '#D1D6DB', // 입력칸 테두리, 남은 진행 점
  ink: '#191F28', // 글자 (흰 바탕 16.6:1)
  inkSoft: '#4E5968', // 부제·보조 글 (흰 바탕 7.1:1, 바탕 6.6:1, surface2 6.5:1)
  // 캡션·날짜·자리표시: 흰 바탕 4.62:1(4.5 이상). 바탕(4.27:1)·surface2(4.19:1) 위 작은 글자에는 inkSoft를 쓴다
  inkMuted: '#6B7684',

  accent: '#2F5BFF', // 파란 강조색. 흰 글자 5.17:1, 흰 바탕 위 글자 5.17:1, 바탕 4.78:1
  accentHover: '#2449E0', // 주요 버튼에 올렸을 때. 흰 글자 6.76:1
  accentDeep: '#1B3BD1', // 주요 버튼 누름, accentPale 위 글자(7.1:1). 흰 글자 8.1:1
  accentPale: '#EAF0FF', // 선택·활성·배지 바탕. 이 위 작은 글자는 accentDeep
  accentInk: '#FFFFFF', // 파랑·빨강 바탕 위 글자
  accentTrack: '#D6E0FF', // 스피너 바닥 고리, 지난 진행 점

  sun: '#FFB020', // 즐겨찾기 별·아주 작은 장식만
  sunPale: '#FFF4D6', // 해 색 옅은 바탕. ink 글자 15.1:1
  sunDeep: '#B87700', // 해 색으로 보여야 하는 작은 아이콘 (흰 바탕 3.70:1, sunPale 3.38:1)

  redpen: '#CC2E2E', // 오류, 탈퇴·삭제 같은 위험한 동작. 흰 글자 5.25:1, 흰 바탕 5.25:1, 바탕 4.86:1
  redpenHover: '#B32424', // 위험 버튼에 올렸을 때. 흰 글자 6.57:1
  redpenDeep: '#8F1D1D', // 위험 버튼 누름. 흰 글자 8.89:1
  redpenPale: '#FDECEC', // 오류 안내의 옅은 바탕. redpen 글자 4.60:1, ink 글자 14.5:1
  pencil: '#C4CAD2', // 빈 자리 점선, 입력칸 hover 테두리 (장식 전용)
  scrim: 'rgba(25, 31, 40, 0.48)', // 오버레이 뒤를 가리는 막 (ink 48%)
  scrimSoft: 'rgba(25, 31, 40, 0.32)', // 가볍게 가리는 막 (ink 32%): 뒤 화면이 비쳐도 되는 안내
};

// 그림자 색: ink(25, 31, 40)
const inkShade = (alpha) => `rgba(25, 31, 40, ${alpha})`;

const pretendard = '"Pretendard", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const theme = {
  colors,

  // 제목·본문 모두 Pretendard. display/body 이름은 그대로 두고 같은 값을 쓴다
  fonts: {
    display: pretendard,
    body: pretendard,
  },

  // 굵기: 화면·섹션 제목 bold, 버튼·라벨·칩·카드 제목 semibold, 본문 regular, 캡션 regular 또는 medium
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    heavy: 800, // '꿈도깨비' 로고 글자(Wordmark)만
  },

  // 글자 간격: 제목 tight, 본문 body
  tracking: {
    tight: '-0.02em',
    body: '-0.01em',
    logo: '-0.03em', // '꿈도깨비' 로고 글자(Wordmark)
  },

  // 글자 크기 단계 (rem)
  text: {
    xs: '0.75rem', // 12px
    caption: '0.8125rem', // 13px: 날짜, 배지
    sm: '0.875rem', // 14px
    md: '0.9375rem', // 15px: 라벨, 칩, 메뉴, 카드 제목
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.375rem', // 22px
    '2xl': 'clamp(1.625rem, 1.35rem + 0.8vw, 2rem)',
    // Pretendard bold는 같은 크기에서 더 무거워 보여 한 단계 줄였다
    '3xl': 'clamp(1.75rem, 1.4rem + 1.2vw, 2.375rem)',
    hero: 'clamp(2.25rem, 1.5rem + 2.8vw, 3.75rem)', // 홈 첫 화면 제목
    // 이야기 글: 390px에서 18px 이상, 1280px에서 22px 이상
    story: 'clamp(1.125rem, 0.95rem + 0.6vw, 1.375rem)',
  },

  leading: {
    tight: 1.25,
    body: 1.75,
  },

  // 간격 단계 (rem)
  space: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.75rem',
    7: '2.5rem',
    8: '3.5rem',
  },

  // 모서리
  radius: {
    card: '1rem', // 카드
    dialog: '1.25rem', // 대화상자
    art: '0.75rem', // 표지·삽화
    btn: '0.875rem', // 버튼
    btnSm: '0.75rem', // 낮은 버튼($size="sm")
    input: '0.75rem', // 입력칸
    tag: '0.5rem', // 배지
    inner: '0.5rem', // 판(PaperFrame)이나 썸네일 버튼 안에 겹친 그림: 바깥 모서리보다 작게
    pill: '999px', // 칩, 진행 점, 메뉴 알약
  },

  // 테두리: 모두 1px 가는 선
  border: {
    card: `1px solid ${colors.line}`, // 카드·칩·보조 버튼
    input: `1px solid ${colors.lineStrong}`, // 입력칸
    rule: `1px solid ${colors.rule}`, // 구분선, 칩 안 작은 그림 같은 작은 요소
  },

  // 그림자: 카드는 테두리로 나누고 그림자를 쓰지 않는다. 막 위의 대화상자만 띄운다
  shadow: {
    card: 'none',
    cardHover: `0 4px 12px ${inkShade(0.06)}`, // 누를 수 있는 카드에 올렸을 때
    dialog: `0 12px 32px ${inkShade(0.16)}`, // 막(scrim) 위에 뜬 카드
    art: 'none', // 표지·삽화: 그림자 없음
    nav: 'none',
    lineTop: `inset 0 1px 0 ${colors.line}`, // 위 가는 선 (휴대폰 아래 탭 막대처럼 크기를 바꾸지 않고 선만 둘 때)
    lineBottom: `inset 0 -1px 0 ${colors.line}`, // 아래 가는 선 (넓은 화면 위 막대)
    ring: `0 0 0 1px ${colors.line}`, // 바깥 가는 테두리: border처럼 보이지만 크기를 바꾸지 않는다 (펼친 책)
    gutter: `inset 1.75rem 0 1.75rem -1.75rem ${inkShade(0.1)}`, // 펼친 책 가운데 접힌 곳의 옅은 그늘
  },

  // 움직임
  motion: {
    fast: '100ms',
    base: '160ms',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    enter: '360ms', // 화면과 장면이 나타날 때 (Card.jsx 의 rise와 함께)
    out: 'cubic-bezier(0.22, 1, 0.36, 1)', // 빠르게 나와 부드럽게 멈춘다
    stagger: '70ms', // 선택지가 차례로 나타나는 간격
    pressScale: 0.98, // 누르면 이만큼 작아진다
  },

  // 최소 터치 크기 (44px)
  tap: '2.75rem',

  // 화면 틀: 메뉴 막대 높이와 페이지 폭. BottomNav와 PageShell이 같은 값을 쓴다
  layout: {
    navH: '4rem', // 휴대폰 아래 탭 막대 (safe-area 아래 여백은 따로 더한다)
    navHWide: '4.5rem', // 넓은 화면(mq.wide) 위 막대
    page: '74rem', // 페이지 최대 폭 (좌우 gutter 포함)
    gutter: 'clamp(1rem, 0.5rem + 2.5vw, 2.5rem)', // 좌우 여백: 390px 약 18px, 1280px 40px
  },

  // 미디어 조건. 쓰는 법: @media ${({ theme }) => theme.mq.wide} { … }
  mq: {
    wide: '(min-width: 56rem)', // 넓은 화면: 메뉴가 위 막대가 되고, 흐름 화면이 그림 | 글 두 칸으로 나뉜다
    narrow: '(max-width: 55.9375rem)', // 메뉴가 아래 탭인 화면
    phone: '(max-width: 40rem)', // 휴대폰: 카드 안쪽 여백을 줄인다
    hover: '(hover: hover)', // 마우스가 있는 기기에서만 hover 모양을 준다
  },

  // 쌓임 순서
  z: {
    nav: 10,
    overlay: 100,
  },

  // 차트 색: 파랑 중심 8색. 모두 흰 바탕(surface) 대비 3:1 이상. CategoryStatsChart가 쓴다
  // 원형 차트는 마지막 조각이 첫 조각(파랑)과 맞닿으므로 모든 색을 파랑과 명도나 색상이 다르게 골랐다.
  // 조각이 몇 개든 이웃한 두 조각은 ΔE2000 12 이상, 앞 6색(장소 선택지 수)끼리도 12 이상이다
  // 파랑 5.2, 남색 12.4, 하늘 3.4, 청록 3.9, 회청 6.4, 바다파랑 4.8, 연보라 3.8, 진청록 6.1
  chart: [colors.accent, '#13288A', '#5A86F5', '#0B8CA8', '#4A5F85', '#0277BD', '#8B6CF6', '#0A6C80'],

  // 웹 글꼴 CDN (frontend/public/index.html 에서 불러온다)
  fontLink: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css',
};

export default theme;
