import styled, { css } from 'styled-components';

// 공통 둥근 사각 버튼. 기본은 보조(흰 바탕 + 가는 테두리), $primary 주요(파랑), $danger 위험(빨강), $quiet 테두리 없는 조용한 버튼.
// $size="sm"은 낮은 버튼(44px), $inline은 폭을 글자에 맞추고 바깥 여백을 없앤다(가로 줄에 놓을 때. 간격은 부모의 gap으로 준다).
// 누르던 버튼이 비활성이 될 때 포커스를 잃지 않게 하려면 disabled 대신 aria-disabled="true"를 준다(모양은 같고, 누름 처리는 부르는 쪽이 막는다).
// 올려도 뜨지 않고, 누르면 살짝 작아지며 바탕이 조금 진해진다.
// 예) <RoundedButton $primary onClick={open}>열기</RoundedButton>  <RoundedButton $danger $size="sm" $inline>지우기</RoundedButton>

const RoundedButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  max-width: 35rem;
  margin: 0 auto;
  min-height: 3.25rem;
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[6]}`};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: 1.3;
  letter-spacing: ${({ theme }) => theme.tracking.body};
  text-align: center;
  text-decoration: none;
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.btn};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;

  & + & {
    margin-top: ${({ theme }) => theme.space[3]};
  }

  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:disabled):not([aria-disabled='true']) {
      background: ${({ theme }) => theme.colors.surface2};
    }
  }

  /* 누르면 살짝 작아지고(전역 규칙과 같은 값) 바탕이 조금 진해진다 */
  &:active:not(:disabled):not([aria-disabled='true']) {
    scale: ${({ theme }) => theme.motion.pressScale};
    background: ${({ theme }) => theme.colors.line};
  }

  ${({ $primary, theme }) =>
    $primary &&
    css`
      background: ${theme.colors.accent};
      border-color: ${theme.colors.accent};
      color: ${theme.colors.accentInk};

      @media ${theme.mq.hover} {
        &:hover:not(:disabled):not([aria-disabled='true']) {
          background: ${theme.colors.accentHover};
          border-color: ${theme.colors.accentHover};
        }
      }

      &:active:not(:disabled):not([aria-disabled='true']) {
        background: ${theme.colors.accentDeep};
        border-color: ${theme.colors.accentDeep};
      }
    `}

  ${({ $danger, theme }) =>
    $danger &&
    css`
      background: ${theme.colors.redpen};
      border-color: ${theme.colors.redpen};
      color: ${theme.colors.accentInk};

      @media ${theme.mq.hover} {
        &:hover:not(:disabled):not([aria-disabled='true']) {
          background: ${theme.colors.redpenHover};
          border-color: ${theme.colors.redpenHover};
        }
      }

      &:active:not(:disabled):not([aria-disabled='true']) {
        background: ${theme.colors.redpenDeep};
        border-color: ${theme.colors.redpenDeep};
      }
    `}

  ${({ $quiet, theme }) =>
    $quiet &&
    css`
      background: transparent;
      border-color: transparent;
      color: ${theme.colors.inkSoft};

      @media ${theme.mq.hover} {
        &:hover:not(:disabled):not([aria-disabled='true']) {
          background: ${theme.colors.surface2};
          color: ${theme.colors.ink};
        }
      }

      &:active:not(:disabled):not([aria-disabled='true']) {
        background: ${theme.colors.line};
      }
    `}

  ${({ $size, theme }) =>
    $size === 'sm' &&
    css`
      min-height: ${theme.tap};
      padding: ${`${theme.space[2]} ${theme.space[4]}`};
      font-size: ${theme.text.md};
      border-radius: ${theme.radius.btnSm};
    `}

  ${({ $inline }) =>
    $inline &&
    css`
      width: auto;
      max-width: none;

      /* 세로로 붙은 버튼의 위 여백(& + &)보다 우선해야 해서 클래스를 세 번 적는다 */
      &&& {
        margin: 0;
      }
    `}

  /* 비활성: 주요·위험 버튼도 회색 면 + inkMuted 글자. 조용한 버튼은 바탕 없이 글자만 흐려진다 */
  &:disabled,
  &[aria-disabled='true'] {
    background: ${({ theme, $quiet }) => ($quiet ? 'transparent' : theme.colors.surface2)};
    border-color: ${({ theme, $quiet }) => ($quiet ? 'transparent' : theme.colors.surface2)};
    color: ${({ theme }) => theme.colors.inkMuted};
    cursor: not-allowed;
  }

  @media ${({ theme }) => theme.mq.phone} {
    padding-inline: ${({ theme }) => theme.space[4]};
  }
`;

export default RoundedButton;
