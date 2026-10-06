import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    -webkit-text-size-adjust: 100%;
    overflow-x: clip;
  }

  body {
    background-color: ${({ theme }) => theme.colors.bg};
    overflow-x: clip;
    color: ${({ theme }) => theme.colors.ink};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: ${({ theme }) => theme.text.base};
    line-height: ${({ theme }) => theme.leading.body};
    word-break: keep-all;
    overflow-wrap: break-word;
    overscroll-behavior: none;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 400;
    font-style: normal;
    line-height: ${({ theme }) => theme.leading.tight};
    letter-spacing: -0.01em;
  }

  p {
    text-wrap: pretty;
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-underline-offset: 0.2em;
  }

  button, input, select, textarea {
    font: inherit;
    color: inherit;
  }

  :focus-visible {
    outline: 0.1875rem solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0.125rem;
  }

  /* 버튼 반응: 마우스를 올리면 살짝 뜨고, 누르면 눌린다.
     button:not(:disabled)가 컴포넌트 클래스보다 우선해서, 각 버튼의 transition 대신 이 목록이 쓰인다 */
  button:not(:disabled),
  [role='button'] {
    transition-property: background-color, border-color, color, translate, scale;
    transition-duration: ${({ theme }) => theme.motion.base};
    transition-timing-function: ${({ theme }) => theme.motion.ease};
  }

  @media (hover: hover) {
    button:not(:disabled):hover,
    [role='button']:hover {
      translate: 0 -0.125rem;
    }
  }

  button:not(:disabled):active,
  [role='button']:active {
    translate: 0 0;
    scale: 0.97;
    transition-duration: ${({ theme }) => theme.motion.fast};
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default GlobalStyle;
