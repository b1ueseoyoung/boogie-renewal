import React from 'react';
import styled from 'styled-components';
import RoundedButton from './RoundedButton';
import mascotImg from '../assets/images/mainCharactor.png';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
`;

const Label = styled.label`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  line-height: ${({ theme }) => theme.leading.tight};
  color: ${({ theme }) => theme.colors.ink};
`;

const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: stretch;
`;

const Input = styled.input`
  display: block;
  flex: 1 1 0;
  width: 100%;
  min-width: 0;
  height: 3.25rem;
  padding: 0 ${({ theme }) => theme.space[4]};
  font-family: ${({ theme }) => theme.fonts.body};
  font-size: ${({ theme }) => theme.text.lg};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.btn};
  transition: border-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  &::placeholder {
    color: ${({ theme }) => theme.colors.pencil};
  }

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.redpen};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 0 0.1875rem ${({ theme }) => theme.colors.accentPale};
  }
`;

const Note = styled.p`
  min-height: 1.3125rem;
  padding-left: ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1.5;
  color: ${({ theme, $tone }) => theme.colors[$tone]};
`;

export const SideButton = styled(RoundedButton)`
  width: auto;
  flex: none;
  min-height: 3.25rem;
  margin: 0;
  padding-inline: ${({ theme }) => theme.space[4]};
  font-size: ${({ theme }) => theme.text.base};
  white-space: nowrap;

  @media (max-width: 30rem) {
    padding-inline: ${({ theme }) => theme.space[4]};
  }
`;

export const TextButton = styled.button`
  align-self: center;
  min-height: ${({ theme }) => theme.tap};
  padding: 0 ${({ theme }) => theme.space[3]};
  border: none;
  background: none;
  cursor: pointer;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.accent};
  text-underline-offset: 0.2em;

  &:hover {
    text-decoration: underline;
  }
`;

export const FormStack = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  max-width: 26rem;
`;

const MascotFrame = styled.div`
  display: none;

  @media (min-width: 52.0625rem) {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
  }
`;

const MascotImg = styled.img`
  display: block;
  width: min(100%, 22rem);
  height: auto;
`;

export const Mascot = () => (
  <MascotFrame aria-hidden="true">
    <MascotImg src={mascotImg} alt="" />
  </MascotFrame>
);

export default function FormField({ id, label, hint, error, ok, side, ...inputProps }) {
  const noteId = `${id}-note`;
  const note = error || ok || hint;
  const tone = error ? 'redpen' : ok ? 'accent' : 'inkSoft';
  return (
    <Wrap>
      <Label htmlFor={id}>{label}</Label>
      <Row>
        <Input id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={note ? noteId : undefined} {...inputProps} />
        {side}
      </Row>
      <Note id={noteId} $tone={tone} role={error ? 'alert' : undefined}>
        {note}
      </Note>
    </Wrap>
  );
}
