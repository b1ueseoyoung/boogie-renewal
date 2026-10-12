import React, { forwardRef } from 'react';
import styled, { css } from 'styled-components';
import { rise } from './Card';

// 이야기 선택지 카드: 흰 카드 + 가는 테두리 위에 번호 원 + semibold 글. 올리면 파란 테두리, 고르면(selected) 옅은 파랑 바탕과 aria-pressed.
// index(0부터)를 주면 번호 원에 index + 1을 쓰고 70ms씩 차례로 떠오른다. index가 없으면 번호 없이 글을 가운데 둔다(장르·장소 고르기).
// imageSrc가 있으면 글 위에 4:3 그림을 둔다. 나머지 props(aria-*, autoFocus …)는 button으로 간다.
// 예) {choices.map((c, i) => <ChoiceButton key={c} index={i} text={c} onClick={() => pick(c)} disabled={pending} />)}

// 번호 원: 옅은 파랑 바탕 + accentDeep 굵은 숫자(7.1:1). 고른 선택지에서는 파랑 바탕 + 흰 숫자
const Num = styled.span`
  display: grid;
  place-items: center;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accentPale};
  color: ${({ theme }) => theme.colors.accentDeep};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.bold};
  line-height: 1;
  transition-property: background-color, color;
  transition-duration: ${({ theme }) => theme.motion.base};
  transition-timing-function: ${({ theme }) => theme.motion.ease};
`;

const Button = styled.button`
  display: flex;
  flex-direction: ${({ $hasImage }) => ($hasImage ? 'column' : 'row')};
  align-items: ${({ $hasImage }) => ($hasImage ? 'stretch' : 'center')};
  justify-content: ${({ $numbered }) => ($numbered ? 'flex-start' : 'center')};
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  min-height: 3.5rem;
  padding: ${({ theme, $numbered }) =>
    $numbered ? `${theme.space[3]} ${theme.space[5]} ${theme.space[3]} ${theme.space[3]}` : `${theme.space[3]} ${theme.space[4]}`};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.btn};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  box-shadow: ${({ theme }) => theme.shadow.card};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: 1.35;
  letter-spacing: ${({ theme }) => theme.tracking.body};
  text-align: ${({ $numbered }) => ($numbered ? 'start' : 'center')};
  cursor: pointer;

  ${({ $order, theme }) =>
    typeof $order === 'number' &&
    css`
      animation: ${rise} ${theme.motion.enter} ${theme.motion.out} backwards;
      animation-delay: calc(120ms + ${$order} * ${theme.motion.stagger});
    `}

  /* 올리면 테두리만 파랑으로 바뀐다(뜨지 않는다) */
  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.accent};
    }
  }

  /* 고른 선택지: 옅은 파랑 바탕 + 파란 테두리(안쪽 1px을 더해 2px로 보인다. 크기는 변하지 않는다), 글자는 accentDeep(7.1:1) */
  ${({ $selected, theme }) =>
    $selected &&
    css`
      &,
      &:hover:not(:disabled) {
        background: ${theme.colors.accentPale};
        border-color: ${theme.colors.accent};
        color: ${theme.colors.accentDeep};
        box-shadow: inset 0 0 0 1px ${theme.colors.accent};
      }

      & ${Num} {
        background: ${theme.colors.accent};
        color: ${theme.colors.accentInk};
      }
    `}

  /* 비활성: RoundedButton과 같은 회색 면 + inkMuted 글자. 번호 원도 회색이 된다 */
  &:disabled {
    background: ${({ theme }) => theme.colors.surface2};
    border-color: ${({ theme }) => theme.colors.line};
    box-shadow: none;
    color: ${({ theme }) => theme.colors.inkMuted};
    cursor: not-allowed;
  }

  &:disabled ${Num} {
    background: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.inkMuted};
  }
`;

const Label = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
`;

const Art = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface2};
`;

const Row = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
`;

const ChoiceButton = forwardRef(function ChoiceButton(
  { text, index, imageSrc, onClick, disabled = false, selected, type = 'button', children, ...rest },
  ref
) {
  const numbered = typeof index === 'number';
  const label = (
    <>
      {numbered && <Num aria-hidden="true">{index + 1}</Num>}
      <Label>{text ?? children}</Label>
    </>
  );
  return (
    <Button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={typeof selected === 'boolean' ? selected : undefined}
      $selected={Boolean(selected)}
      $numbered={numbered}
      $order={numbered ? index : undefined}
      $hasImage={Boolean(imageSrc)}
      {...rest}
    >
      {imageSrc ? (
        <>
          <Art src={imageSrc} alt="" />
          <Row>{label}</Row>
        </>
      ) : (
        label
      )}
    </Button>
  );
});

export default ChoiceButton;
