import styled, { keyframes } from 'styled-components';
import { Overlay, DialogCard } from './Card';
import { SunDisc } from './BaseScreenLayout';
import dokkaebiWave from '../assets/images/dokkaebi_loading1.png';
import dokkaebiSmile from '../assets/images/dokkaebi_loading2.png';

// 기다리는 동안: 옅은 파랑 원 위에서 방망이를 흔드는 도깨비(그림 두 장을 번갈아), 문구, 통통 뛰는 파란 점 세 개, 지난 시간.
// 움직임을 줄이는 설정이면 웃는 도깨비 한 장만 멈춰 있고 점도 뛰지 않는다.

// 그림 두 장이 같은 자리에서 번갈아 보인다: 한 장은 앞 반, 다른 한 장은 뒤 반(반 주기 늦게 시작)에만 보인다.
// 투명 바탕 그림이라 한 장이 보일 때 다른 한 장은 완전히 숨겨야 겹쳐 보이지 않는다
const flip = keyframes`
  0% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
`;

const hop = keyframes`
  0%, 60%, 100% {
    translate: 0 0;
    opacity: 0.35;
  }
  30% {
    translate: 0 -0.375rem;
    opacity: 1;
  }
`;

const Panel = styled(DialogCard)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const Art = styled(SunDisc)`
  margin-bottom: ${({ theme }) => theme.space[5]};

  & > img {
    animation: ${flip} 1.2s steps(1, end) infinite;
  }

  & > img:last-child {
    animation-delay: -0.6s;
  }

  /* 움직임을 줄이면 웃는 도깨비 한 장만 보인다 */
  @media (prefers-reduced-motion: reduce) {
    & > img {
      animation: none;
    }

    & > img:first-child {
      visibility: hidden;
    }
  }
`;

const Text = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  letter-spacing: ${({ theme }) => theme.tracking.tight};
  color: ${({ theme }) => theme.colors.ink};
  text-wrap: balance;
`;

const Dots = styled.span`
  display: inline-flex;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[4]};

  & > span {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accent};
    opacity: 0.35;
    animation: ${hop} 1.2s ${({ theme }) => theme.motion.ease} infinite;
  }

  & > span:nth-child(2) {
    animation-delay: 0.15s;
  }

  & > span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @media (prefers-reduced-motion: reduce) {
    & > span {
      animation: none;
      opacity: 1;
    }
  }
`;

const Clock = styled.p`
  margin-top: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.text.sm};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.inkMuted};
`;

export default function WaitingOverlay({ message, elapsed }) {
  return (
    <Overlay role="status" aria-live="polite" aria-busy="true">
      <Panel $maxWidth="22rem" $pad="lg">
        <Art $size="9rem" $fill="78%" aria-hidden="true">
          <img src={dokkaebiWave} alt="" />
          <img src={dokkaebiSmile} alt="" />
        </Art>
        <Text>{message}</Text>
        <Dots aria-hidden="true">
          <span />
          <span />
          <span />
        </Dots>
        {typeof elapsed === 'number' && <Clock>{elapsed}초 지났어요</Clock>}
      </Panel>
    </Overlay>
  );
}
