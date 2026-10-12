import styled, { keyframes } from 'styled-components';

// 불러오는 동안의 빈 자리: rule 면이 line 색으로 은은하게 깜빡인다(흰 카드·회백 바탕 어디서나 보인다). 움직임을 줄이는 설정이면 멈춘다.
// 크기와 비율은 쓰는 쪽이 정한다. $round면 알약(글줄 자리), 아니면 그림 모서리(radius.art).
// 예) const GhostCover = styled(Skeleton)`aspect-ratio: 3 / 4;`
// keyframes는 theme를 받지 못해서, 깜빡일 색은 Skeleton의 --pulse 변수로 넘긴다
const pulse = keyframes`
  50% {
    background-color: var(--pulse);
  }
`;

const Skeleton = styled.span`
  display: block;
  border-radius: ${({ theme, $round }) => ($round ? theme.radius.pill : theme.radius.art)};
  --pulse: ${({ theme }) => theme.colors.line};
  background-color: ${({ theme }) => theme.colors.rule};
  animation: ${pulse} 1.4s ${({ theme }) => theme.motion.ease} infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export default Skeleton;
