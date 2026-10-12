import React from 'react';
import styled from 'styled-components';
import mascotImg from '../assets/images/mainCharactor.png';
import { BsExclamationCircleFill } from 'react-icons/bs';
import BaseTextButton from './TextButton';
import Wordmark from './Wordmark';

// 입력 칸 하나: 라벨(semibold) → 둥근 사각 입력창 → 도움말·오류 한 줄. 라벨·입력 글자·도움말이 같은 왼쪽 선(space[4])에서 시작한다
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const Label = styled.label`
  margin-bottom: ${({ theme }) => theme.space[2]};
  padding-left: ${({ theme }) => theme.space[4]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  color: ${({ theme }) => theme.colors.ink};
`;

const Input = styled.input`
  display: block;
  width: 100%;
  min-width: 0;
  min-height: ${({ theme }) => theme.tap};
  height: 3.25rem;
  padding: 0 ${({ theme }) => theme.space[4]};
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.input};
  border-radius: ${({ theme }) => theme.radius.input};
  transition-property: border-color, box-shadow;
  transition-duration: ${({ theme }) => theme.motion.base};
  transition-timing-function: ${({ theme }) => theme.motion.ease};

  /* 자리표시 글자: inkMuted(흰 칸 위 4.62:1). 적은 글자(ink)와는 색으로 구분된다 */
  &::placeholder {
    color: ${({ theme }) => theme.colors.inkMuted};
    opacity: 1;
  }

  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:focus):not(:disabled) {
      border-color: ${({ theme }) => theme.colors.pencil};
    }
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 0 0.1875rem ${({ theme }) => theme.colors.accentPale};
  }

  /* 오류 칸은 고치려고 눌러도 빨간 테두리를 지킨다 */
  &[aria-invalid='true'],
  &[aria-invalid='true']:hover {
    border-color: ${({ theme }) => theme.colors.redpen};
  }

  &[aria-invalid='true']:focus {
    box-shadow: 0 0 0 0.1875rem ${({ theme }) => theme.colors.redpenPale};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.surface2};
    border-color: ${({ theme }) => theme.colors.line};
    color: ${({ theme }) => theme.colors.inkSoft};
    cursor: not-allowed;
  }

  /* 브라우저 자동 완성이 칠하는 바탕을 흰색으로 덮는다 */
  &:-webkit-autofill {
    -webkit-text-fill-color: ${({ theme }) => theme.colors.ink};
    caret-color: ${({ theme }) => theme.colors.ink};
    -webkit-box-shadow: 0 0 0 100rem ${({ theme }) => theme.colors.surface} inset;
  }
`;

// 도움말·오류 한 줄. 비어 있어도 한 줄 자리를 지켜 아래 칸이 밀리지 않는다
const Note = styled.p`
  min-height: 1.5em;
  margin-top: ${({ theme }) => theme.space[1]};
  padding-left: ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1.5;
  color: ${({ theme, $tone }) => theme.colors[$tone]};
`;

// 폼 아래 보조 길("처음이에요? 회원가입"). 공용 TextButton을 폼 가운데에 둔다
export const TextButton = styled(BaseTextButton)`
  align-self: center;
`;

// 보조 글자 + 글자 버튼 한 줄. 예) <AltLine>처음이에요?<TextButton …>회원가입</TextButton></AltLine>
export const AltLine = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  column-gap: ${({ theme }) => theme.space[1]};
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: ${({ theme }) => theme.text.base};
`;

// 폼 전체 오류(서버·네트워크): 어느 한 칸의 문제가 아니므로 버튼 바로 위 한 줄에 둔다. 글자가 있을 때만 그린다.
// 예) <FormAlert>{formError}</FormAlert>
const AlertLine = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  border-radius: ${({ theme }) => theme.radius.input};
  background: ${({ theme }) => theme.colors.redpenPale};
  color: ${({ theme }) => theme.colors.redpen};
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1.5;

  & > svg {
    flex: none;
    margin-top: 0.25em;
  }
`;

export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <AlertLine role="alert">
      <BsExclamationCircleFill aria-hidden="true" />
      <span>{children}</span>
    </AlertLine>
  );
}

export const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  max-width: 26rem;
`;

// 넓은 화면의 큰 도깨비(그림 열). 좁으면 숨기고, 대신 화면이 카드 위에 AuthBrand를 둔다.
// data-wide-only: BaseScreenLayout이 좁은 화면에서 빈 그림 줄을 남기지 않도록 알아보는 표시
const MascotFrame = styled.div`
  display: none;

  @media ${({ theme }) => theme.mq.wide} {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
  }
`;

// 도깨비 뒤에 옅은 파랑 원을 깐다
const MascotArt = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  width: min(100%, 22rem);

  &::before {
    content: '';
    position: absolute;
    width: 82%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accentPale};
  }
`;

const MascotImg = styled.img`
  position: relative;
  display: block;
  width: 100%;
  height: auto;
`;

export const Mascot = () => (
  <MascotFrame aria-hidden="true" data-wide-only="">
    <MascotArt>
      <MascotImg src={mascotImg} alt="" />
    </MascotArt>
  </MascotFrame>
);

// 좁은 화면(Mascot이 숨는 곳)에서 카드 맨 위에 두는 '꿈도깨비' 로고(마크 + 글자). 넓은 화면에서는 숨는다.
// 로고 마크가 도깨비 얼굴이라 따로 도깨비 그림을 두지 않는다. 카드 맨 위라 메뉴 막대보다 한 단계 크게(text.2xl).
// 예) <BaseScreenLayout brand={<AuthBrand />} aside={<Mascot />} …>
const BrandRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  @media ${({ theme }) => theme.mq.wide} {
    display: none;
  }
`;

const AuthWordmark = styled(Wordmark)`
  font-size: ${({ theme }) => theme.text['2xl']};
`;

export const AuthBrand = () => (
  <BrandRow>
    <AuthWordmark />
  </BrandRow>
);

// aria-describedby를 따로 주면 이 칸의 도움말·오류 줄 뒤에 이어 붙인다(다른 칸의 문구를 함께 읽힐 때)
export default function FormField({ id, label, hint, error, 'aria-describedby': describedBy, ...inputProps }) {
  const noteId = `${id}-note`;
  const note = error || hint;
  const tone = error ? 'redpen' : 'inkSoft';
  const describedByIds = [note ? noteId : null, describedBy].filter(Boolean).join(' ') || undefined;
  return (
    <Wrap>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={describedByIds} {...inputProps} />
      <Note id={noteId} $tone={tone} role={error ? 'alert' : undefined}>
        {note}
      </Note>
    </Wrap>
  );
}
