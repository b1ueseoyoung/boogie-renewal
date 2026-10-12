import React, { useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import BaseScreenLayout, { SunDisc } from '../components/BaseScreenLayout';
import dokkaebiFrame1 from '../assets/images/dokkaebi_loading1.png';
import dokkaebiFrame2 from '../assets/images/dokkaebi_loading2.png';

const frames = [dokkaebiFrame1, dokkaebiFrame2];

// 움직임을 줄이는 설정이면 웃는 도깨비 한 장만 멈춰 보인다(WaitingOverlay와 같다)
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia) && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 옅은 파랑 원(SunDisc) 위의 도깨비. 좁은 화면에서는 작게 둔다
const Art = styled(SunDisc)`
  width: min(60%, 11rem);
  margin: 0 auto;

  @media ${({ theme }) => theme.mq.wide} {
    width: min(100%, 16rem);
  }
`;

const CreatingStoryScreen = () => {
  const navigate = useNavigate();
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    // 1) 실제론 AI API 호출 or WebSocket 대기
    // 2) 여기선 예시로 3초 후 ResultScreen 이동
    const interval = setInterval(() => {
        setFrameIndex((prev) => (prev === 0 ? 1 : 0));
      }, 500);

    const timer = setTimeout(() => {
      navigate('/result'); // 로딩 끝 -> ResultScreen
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [navigate]);

  const frame = prefersReducedMotion() ? dokkaebiFrame2 : frames[frameIndex];

  return (
    <BaseScreenLayout
      progressText="이야기 생성 중"
      title="도깨비가 이야기를 만들고 있어요!"
      subTitle="잠시만 기다려 주세요..."
      aside={
        <Art $fill="70%" aria-hidden="true">
          <img src={frame} alt="" />
        </Art>
      }
    >
    </BaseScreenLayout>
  );
};

export default CreatingStoryScreen;
