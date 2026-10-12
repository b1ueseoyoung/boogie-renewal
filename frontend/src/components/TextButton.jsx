import styled, { css } from 'styled-components';

// 글자처럼 보이는 버튼(“회원가입하기”, “책장 전체 보기” 같은 보조 길). 파란 semibold 글자, 올리면 밑줄. 누를 자리는 44px 이상.
// 링크로 쓰려면 as를 준다: <TextButton as={Link} to="/bookshelf">책장 전체 보기</TextButton>. 그냥 버튼이면 type은 기본 "button".
// $size="sm"은 작은 글자, $soft는 덜 눈에 띄는 보조 글자색(inkSoft).

const TextButton = styled.button.attrs(({ as, type }) => (as ? {} : { type: type || 'button' }))`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: ${({ theme }) => theme.tap};
  min-width: ${({ theme }) => theme.tap};
  padding: ${({ theme }) => `0 ${theme.space[2]}`};
  border: none;
  border-radius: ${({ theme }) => theme.radius.tag};
  background: none;
  color: ${({ theme, $soft }) => ($soft ? theme.colors.inkSoft : theme.colors.accent)};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme, $size }) => ($size === 'sm' ? theme.text.sm : theme.text.base)};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  text-decoration: none;
  text-underline-offset: 0.25em;
  text-decoration-thickness: 0.0625rem;
  cursor: pointer;

  /* 올리면 밑줄과 진한 글자(뜨지 않는다). 버튼으로 그리면 누를 때 전역 규칙대로 살짝 작아진다 */
  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:disabled) {
      text-decoration-line: underline;
      color: ${({ theme, $soft }) => ($soft ? theme.colors.ink : theme.colors.accentDeep)};
    }
  }

  ${({ $soft }) =>
    !$soft &&
    css`
      &:active:not(:disabled) {
        color: ${({ theme }) => theme.colors.accentDeep};
      }
    `}

  /* 비활성: RoundedButton과 같이 흐린 글자(inkMuted)만 */
  &:disabled {
    color: ${({ theme }) => theme.colors.inkMuted};
    cursor: not-allowed;
  }
`;

export default TextButton;
