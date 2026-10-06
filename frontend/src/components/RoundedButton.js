import styled, { css } from 'styled-components';

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
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 400;
  line-height: 1.3;
  text-align: center;
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.btn};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  box-shadow: ${({ theme }) => theme.shadow.ledgeSoft};
  margin-bottom: 0.25rem; /* 바닥 턱 자리 */
  cursor: pointer;

  &:active:not(:disabled) {
    box-shadow: none;
  }
  transition:
    background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`},
    color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  & + & {
    margin-top: ${({ theme }) => theme.space[3]};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.bg};
  }

  ${({ $primary, theme }) =>
    $primary &&
    css`
      background: ${theme.colors.accent};
      border-color: ${theme.colors.accent};
      color: ${theme.colors.accentInk};
      box-shadow: ${theme.shadow.ledge};

      &:hover {
        background: ${theme.colors.accentDeep};
        border-color: ${theme.colors.accentDeep};
      }
    `}

  ${({ $quiet, theme }) =>
    $quiet &&
    css`
      border: ${theme.border.rule};
      box-shadow: none;
      font-family: ${theme.fonts.body};
      font-size: ${theme.text.base};
      color: ${theme.colors.inkSoft};
    `}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 30rem) {
    padding-inline: ${({ theme }) => theme.space[4]};
  }
`;

export default RoundedButton;
