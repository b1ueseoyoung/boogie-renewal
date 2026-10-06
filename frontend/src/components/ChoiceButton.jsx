import React from 'react';
import styled from 'styled-components';

const Button = styled.button`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: ${({ theme }) => theme.tap};
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.card};
  background-color: ${({ theme }) => theme.colors.surface2};
  ${({ $imageSrc }) => $imageSrc && `background-image: url(${$imageSrc});`}
  background-size: cover;
  background-position: center;
  color: ${({ theme }) => theme.colors.ink};
  cursor: pointer;

  &:hover > span {
    background: ${({ theme }) => theme.colors.accentPale};
  }
`;

const Label = styled.span`
  width: 100%;
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  background: ${({ theme }) => theme.colors.surface};
  border-top: ${({ theme }) => theme.border.rule};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  font-weight: 500;
  transition: background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
  line-height: 1.3;
  text-align: center;
`;

const ChoiceButton = ({ text, imageSrc, onClick }) => (
  <Button type="button" $imageSrc={imageSrc} onClick={onClick}>
    <Label>{text}</Label>
  </Button>
);

export default ChoiceButton;
