import React from 'react';
import styled, { css } from 'styled-components';

// 고르는 그림 카드의 선택 표시. 기존 캐릭터 고르기, 후보 썸네일, 책장 편집이 같은 모양을 쓴다.
// 고르면: 옅은 파랑 바탕(카드가 있으면) + 파란 고리(pickedRing) + 오른쪽 위 파란 체크 원(PickCheck).
// 여러 권을 고르는 곳(책장 편집)은 고르지 않은 칸에도 빈 원을 둬서 고를 수 있다는 것을 보인다(<PickCheck picked={false} />).

// 고른 고리: 카드 바깥에 0.1875rem. 포커스 고리와 겹치지 않도록 쓰는 쪽은 outline-offset을 0.375rem으로 둔다
export const pickedRing = (theme) => `0 0 0 0.1875rem ${theme.colors.accent}`;

const Circle = styled.span`
  position: absolute;
  top: ${({ theme }) => theme.space[2]};
  right: ${({ theme }) => theme.space[2]};
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accentInk};
  /* 그림 위에서도 보이도록 흰 테두리를 두른다 */
  box-shadow: 0 0 0 0.125rem ${({ theme }) => theme.colors.surface};
  pointer-events: none;
  transition-property: background-color, box-shadow;
  transition-duration: ${({ theme }) => theme.motion.base};
  transition-timing-function: ${({ theme }) => theme.motion.ease};

  ${({ $empty, theme }) =>
    $empty &&
    css`
      background: ${theme.colors.surface};
      box-shadow: inset 0 0 0 0.125rem ${theme.colors.inkMuted}, 0 0 0 0.125rem ${theme.colors.surface};
    `}

  & svg {
    width: 1rem;
    height: 1rem;
  }
`;

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function PickCheck({ picked = true, className }) {
  return (
    <Circle className={className} $empty={!picked} aria-hidden="true">
      {picked && <CheckIcon />}
    </Circle>
  );
}
