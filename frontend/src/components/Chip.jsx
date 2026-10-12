import React, { forwardRef } from 'react';
import styled, { css } from 'styled-components';

// 알약 칩 버튼(책장 주인공 고르기, 필터 같은 것). selected면 aria-pressed가 켜지고 옅은 파랑으로 바뀐다.
// 앞에 작은 동그라미 그림(image, imageAlt) 또는 아이콘(icon)을 둘 수 있다. 나머지 props(onClick, disabled …)는 button으로 간다.
// 예) <Chip selected={!picked} onClick={selectAll}>전체</Chip>  <Chip selected={picked === id} image={charImg}>{charName}</Chip>

const ChipButton = styled.button`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.tap};
  padding: ${({ theme, $hasLead }) => ($hasLead ? `0 ${theme.space[4]} 0 ${theme.space[1]}` : `0 ${theme.space[4]}`)};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  white-space: nowrap;
  cursor: pointer;

  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surface2};
    }
  }

  /* 고른 칩: 옅은 파랑 바탕 + 파란 테두리, 글자는 accentDeep(7.1:1) */
  ${({ $selected, theme }) =>
    $selected &&
    css`
      &,
      &:hover:not(:disabled) {
        background: ${theme.colors.accentPale};
        border-color: ${theme.colors.accent};
        color: ${theme.colors.accentDeep};
      }
    `}

  /* 비활성: RoundedButton과 같은 회색 면 + inkMuted 글자 */
  &:disabled {
    background: ${({ theme }) => theme.colors.surface2};
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.inkMuted};
    cursor: not-allowed;
  }

  @media ${({ theme }) => theme.mq.phone} {
    font-size: ${({ theme }) => theme.text.sm};
  }
`;

const Thumb = styled.img`
  display: block;
  flex: none;
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 50%;
  border: ${({ theme }) => theme.border.rule};
  background: ${({ theme }) => theme.colors.surface2};
  object-fit: cover;
  object-position: top;
`;

const Icon = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 2.125rem;
  height: 2.125rem;
  font-size: ${({ theme }) => theme.text.lg};

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

const Chip = forwardRef(function Chip({ selected = false, image, imageAlt = '', icon, children, type = 'button', ...rest }, ref) {
  const hasLead = Boolean(image || icon);
  return (
    <ChipButton ref={ref} type={type} aria-pressed={selected} $selected={selected} $hasLead={hasLead} {...rest}>
      {image ? (
        <Thumb src={image} alt={imageAlt} />
      ) : (
        icon && <Icon aria-hidden="true">{icon}</Icon>
      )}
      <span>{children}</span>
    </ChipButton>
  );
});

export default Chip;
