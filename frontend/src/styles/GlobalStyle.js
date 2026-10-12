import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
    overflow-x: clip;
    accent-color: ${({ theme }) => theme.colors.accent};
    /* 얇은 스크롤 막대 (scrollbar-color는 안쪽 요소로 이어진다) */
    scrollbar-color: ${({ theme }) => `${theme.colors.lineStrong} transparent`};
  }

  * {
    scrollbar-width: thin;
  }

  body {
    /* 바탕은 단색 하나(종이 결 없음) */
    background-color: ${({ theme }) => theme.colors.bg};
    overflow-x: clip;
    color: ${({ theme }) => theme.colors.ink};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: ${({ theme }) => theme.text.base};
    font-weight: ${({ theme }) => theme.weight.regular};
    line-height: ${({ theme }) => theme.leading.body};
    letter-spacing: ${({ theme }) => theme.tracking.body};
    /* Pretendard는 굵기마다 실제 글꼴이 있으니 가짜 굵게·기울임을 만들지 않는다 */
    font-synthesis: none;
    word-break: keep-all;
    overflow-wrap: break-word;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  h1, h2, h3 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: ${({ theme }) => theme.weight.bold};
    font-style: normal;
    line-height: ${({ theme }) => theme.leading.tight};
    letter-spacing: ${({ theme }) => theme.tracking.tight};
  }

  p {
    text-wrap: pretty;
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-underline-offset: 0.2em;
  }

  /* 브라우저 기본값(letter-spacing: normal) 대신 본문 글자 간격을 이어받는다 */
  button, input, select, textarea {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
  }

  ::selection {
    background: ${({ theme }) => theme.colors.accentPale};
    color: ${({ theme }) => theme.colors.ink};
  }

  :focus-visible {
    outline: 0.1875rem solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0.125rem;
  }

  /* 버튼 반응. 올려도 뜨지 않고, 누르면 살짝 작아진다(motion.pressScale). 바탕색 변화는 각 버튼이 맡는다.
     button:not(:disabled)가 컴포넌트 클래스보다 우선해서, 각 버튼의 transition 대신 이 목록이 쓰인다.
     컴포넌트에서 누름 반응을 끄려면 클래스를 세 번 적어야 이긴다: &&&:active { scale: none; } */
  /* aria-disabled 버튼(포커스를 지키려고 disabled 대신 쓰는 비활성)도 반응하지 않는다 */
  button:not(:disabled):not([aria-disabled='true']),
  [role='button']:not([aria-disabled='true']) {
    transition-property: background-color, border-color, color, box-shadow, opacity, scale;
    transition-duration: ${({ theme }) => theme.motion.base};
    transition-timing-function: ${({ theme }) => theme.motion.ease};
  }

  button:not(:disabled):not([aria-disabled='true']):active,
  [role='button']:not([aria-disabled='true']):active {
    scale: ${({ theme }) => theme.motion.pressScale};
    transition-duration: ${({ theme }) => theme.motion.fast};
  }

  /* 움직임을 줄이면 길이뿐 아니라 지연도 없앤다(차례로 떠오르는 선택지가 지연 동안 안 보이지 않게) */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      transition-delay: 0s !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default GlobalStyle;
