import styled, { css, keyframes } from 'styled-components';

// 흰 카드: 그림자 없이 가는 테두리(border.card)와 둥근 모서리로 바탕과 나눈 면. 안쪽 여백은 $pad="none|sm|md|lg"(기본 md).
// 다른 태그가 필요하면 as를 쓴다. 예) <Card as="section" $pad="lg">…</Card>
// 막 위에 띄우는 카드는 <Overlay><DialogCard $maxWidth="24rem">…</DialogCard></Overlay>(가벼운 막은 <Overlay $soft>). 닫기·포커스 동작까지 필요하면 Dialog.jsx를 쓴다.

// 아래에서 살짝 떠오르며 나타난다 (BaseScreenLayout의 rise와 같은 움직임)
export const rise = keyframes`
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
`;

// 서서히 나타난다 (막)
export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
`;

// 안쪽 여백: [넓은 화면, 휴대폰]의 theme.space 단계
const pads = {
  none: [0, 0],
  sm: [4, 4],
  md: [6, 5],
  lg: [7, 6],
};

const padding = ({ theme, $pad }) => {
  const [wide, phone] = pads[$pad] || pads.md;
  return css`
    padding: ${wide ? theme.space[wide] : '0'};

    @media ${theme.mq.phone} {
      padding: ${phone ? theme.space[phone] : '0'};
    }
  `;
};

const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.card};
  box-shadow: ${({ theme }) => theme.shadow.card};
  ${padding}
`;

// 화면 전체를 덮는 막. 안의 카드는 가운데에 놓이고, 카드가 화면보다 길면 막 안에서 스크롤된다
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ theme }) => theme.z.overlay};
  display: flex;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: ${({ theme }) => theme.space[4]};
  padding-bottom: calc(${({ theme }) => theme.space[4]} + env(safe-area-inset-bottom));
  background: ${({ theme, $soft }) => ($soft ? theme.colors.scrimSoft : theme.colors.scrim)};
  animation: ${fadeIn} ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
`;

// 막 위에 뜬 카드. 폭은 $maxWidth(기본 24rem)까지, 가운데 정렬은 margin auto가 맡는다(길어져도 위가 잘리지 않는다).
// 막 위에서는 테두리 대신 그림자로 띄운다
export const DialogCard = styled(Card)`
  position: relative;
  width: min(100%, ${({ $maxWidth }) => $maxWidth || '24rem'});
  margin: auto;
  border: none;
  border-radius: ${({ theme }) => theme.radius.dialog};
  box-shadow: ${({ theme }) => theme.shadow.dialog};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  &:focus {
    outline: none;
  }
`;

// 안내 상자: 옅은 파랑 바탕, 테두리 없음. 사진 안내, 흐름이 끊겼다는 안내처럼 화면 안의 짧은 알림에 쓴다.
// 아이콘을 앞에 두려면 <NoteBox $icon><svg …/><span>…</span></NoteBox>(아이콘은 accentDeep, 첫 줄 가운데)
export const NoteBox = styled.div`
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.accentPale};
  color: ${({ theme }) => theme.colors.ink};

  ${({ $icon, theme }) =>
    $icon &&
    css`
      display: flex;
      gap: ${theme.space[3]};
      align-items: flex-start;

      & > svg {
        flex: none;
        width: 1.25rem;
        height: 1.25rem;
        margin-top: 0.125rem;
        color: ${theme.colors.accentDeep};
      }
    `}
`;

export default Card;
