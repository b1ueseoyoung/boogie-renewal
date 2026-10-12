import React from 'react';
import styled from 'styled-components';
import Lottie from 'react-lottie-player';
import finishAnimation from '../assets/finishAnimation.json';
import RoundedButton from './RoundedButton';

// 사진을 고를 자리: 옅은 회색 면(surface2)에 회색 점선(빈 사진 자리), 가운데 옅은 파랑 원 안의 파란 사진기, 아래 주요 버튼
const Zone = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.space[5]};
  padding: ${({ theme }) => `${theme.space[7]} ${theme.space[5]}`};
  background: ${({ theme }) => theme.colors.surface2};
  border: 0.125rem dashed ${({ theme }) => theme.colors.pencil};
  border-radius: ${({ theme }) => theme.radius.card};
  text-align: center;

  @media ${({ theme }) => theme.mq.phone} {
    padding: ${({ theme }) => `${theme.space[6]} ${theme.space[4]}`};
  }
`;

const Badge = styled.span`
  display: grid;
  place-items: center;
  width: 8rem;
  height: 8rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accentPale};
  color: ${({ theme }) => theme.colors.accent};
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
    <Badge>
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
    </Badge>
    <RoundedButton $primary type="button" onClick={onClick}>
      {label}
    </RoundedButton>
  </Zone>
);

export default GallerySelectButton;
