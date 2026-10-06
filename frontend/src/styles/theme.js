// 그림책 방향. 규칙은 저장소 루트 design.md 에 있다.
// 바탕은 밝은 크림색 종이 하나만 쓴다(운영체제 다크 모드 전환은 이번 범위가 아니다).
// 면은 검은 테두리 대신 부드러운 그림자로 띄운다.

const colors = {
  bg: '#fbf5ea', // 크림색 종이 (바탕)
  surface: '#fffdf8', // 종이 카드
  surface2: '#f4ead9', // 그림 자리, 보조 면
  rule: '#eadfcb', // 가는 선
  line: '#e2d3bb', // 카드와 버튼 테두리
  ink: '#2f2620', // 글자
  inkSoft: '#6b5d52', // 보조 글자

  accent: '#2f5bff', // 파란 강조색 (개인 규칙, 라이트)
  accentPale: '#e3e9ff',
  accentInk: '#ffffff',
  accentDeep: '#1b3bd1',

  sun: '#f7c548', // 도깨비 노랑: 번호 스티커, 진행 점 같은 장식에만
  sunPale: '#fdf0c8',
  leaf: '#5b8f4e', // 도깨비 초록: 장식에만

  redpen: '#c62d20', // 오류, 탈퇴·삭제 같은 위험한 동작 (종이 대비 5.44:1)
  pencil: '#b5a796', // 빈 사진 자리의 점선
  accentTrack: '#c3d0ff', // 스피너의 바닥 고리
  scrim: 'rgba(47, 38, 32, 0.55)', // 오버레이 뒤를 가리는 막 (ink 55%)
};

const display = '"Jua", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const body = '"Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const theme = {
  colors,

  // 제목·버튼은 Jua, 본문·이야기 글은 Gowun Dodum
  fonts: {
    display,
    body,
  },

  // 글자 크기 단계 (rem)
  text: {
    xs: '0.75rem', // 12px
    sm: '0.875rem', // 14px
    base: '1rem', // 16px
    lg: '1.125rem', // 18px
    xl: '1.375rem', // 22px
    '2xl': 'clamp(1.625rem, 1.35rem + 0.8vw, 2rem)',
    '3xl': 'clamp(2rem, 1.5rem + 1.6vw, 2.75rem)',
    hero: 'clamp(2.5rem, 1.6rem + 3.4vw, 4.5rem)', // 홈 첫 화면 제목
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
    card: '1.5rem',
    art: '1.25rem',
    btn: '999px',
    tag: '0.75rem',
  },

  // 테두리: 검은 굵은 선 대신 베이지 선
  border: {
    thick: `0.125rem solid ${colors.line}`,
    rule: `0.0625rem solid ${colors.rule}`,
  },

  // 그림자: 카드는 부드럽게 띄우고, 버튼은 바닥 턱으로 눌리는 느낌을 준다
  shadow: {
    card: '0 1.5rem 3rem -1.75rem rgba(91, 64, 34, 0.38), 0 0.125rem 0.375rem rgba(91, 64, 34, 0.06)',
    art: '0 1.25rem 2.5rem -1.25rem rgba(91, 64, 34, 0.45)',
    ledge: `0 0.25rem 0 ${colors.accentDeep}`,
    ledgeSoft: `0 0.25rem 0 ${colors.line}`,
  },

  // 움직임
  motion: {
    fast: '100ms',
    base: '160ms',
    ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
    enter: '360ms', // 화면과 장면이 나타날 때
    out: 'cubic-bezier(0.22, 1, 0.36, 1)', // 빠르게 나와 부드럽게 멈춘다
  },

  // 최소 터치 크기 (44px)
  tap: '2.75rem',

  // 흐름 밖 화면(로그인, 회원가입, 설정, 결과, 책장 편집, 부모 리포트 차트)이 쓰던 이전 색.
  // 시안 C로 다시 입히지 않은 화면이라 값을 그대로 두고, 화면 파일에 색을 직접 적지 않도록 여기로만 옮겼다.
  legacy: {
    night: '#001840',
    paper: '#fdfcfa',
    mist: '#aaaaaa',
    gold: '#ffc642',
    goldInk: '#1a202b',
    black: '#000000',
    ok: '#6fff8c',
    ng: '#ee5555',
    coral: '#ff6b6b',
    chart: ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#ffbb28', '#00c49f', '#ff6699', '#3399ff'],
  },

  // 웹 글꼴 CDN (frontend/public/index.html 에서 불러온다)
  fontLink: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap',
};

export default theme;
