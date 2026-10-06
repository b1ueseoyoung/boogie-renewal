import React from 'react';
import styled from 'styled-components';
import Lottie from 'react-lottie-player';
import finishAnimation from '../assets/finishAnimation.json';
import RoundedButton from './RoundedButton';

const Zone = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => `${theme.space[6]} ${theme.space[4]}`};
  background: ${({ theme }) => theme.colors.surface};
  border: 0.125rem dashed ${({ theme }) => theme.colors.pencil};
  border-radius: ${({ theme }) => theme.radius.card};
  color: ${({ theme }) => theme.colors.pencil};
  text-align: center;
`;

const CameraIcon = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8a2 2 0 0 1 2-2h2.5l1.2-2h6.6l1.2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.5" r="3.8" />
  </svg>
);

const GallerySelectButton = ({
  label = '갤러리에서 \n사진 찾아오기',
  onClick,
  isFinished = false,
}) => (
  <Zone>
    {isFinished ? (
      <Lottie
        loop={false}
        play
        animationData={finishAnimation}
        style={{ width: 128, height: 128 }}
      />
    ) : (
      <CameraIcon />
    )}
    <RoundedButton $primary type="button" onClick={onClick}>
      {label}
    </RoundedButton>
  </Zone>
);

export default GallerySelectButton;
