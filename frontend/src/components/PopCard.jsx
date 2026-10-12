import { useId } from 'react';
import styled from 'styled-components';
import { DialogCard } from './Card';
import { PaperFrame } from './BaseScreenLayout';
import RoundedButton from './RoundedButton';
import { CoverImg } from './Placeholder';
import { WarnBadge } from './Notice';

// 막 위에 띄우는 작은 흰 카드(그림 → 제목 → 부제 → 설명 → 버튼). 막(Overlay)은 부르는 화면이 그린다.
// 긍정 버튼은 파랑($primary), danger면 빨강($danger). 부정 버튼은 보조. buttonDirection="column"이면 버튼을 세로로 쌓는다.
// 높이는 내용에 맞춘다. imageSize는 그림 틀의 최대 폭(기본 12rem). positivePadding·negativePadding·fitContent는 예전 호출부와의 호환용으로만 받는다.

const Panel = styled(DialogCard)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  max-height: calc(100dvh - 2 * ${({ theme }) => theme.space[4]});
  overflow-y: auto;
  overscroll-behavior: contain;
  text-align: center;
`;

const Frame = styled(PaperFrame)`
  flex: none;
  max-width: ${({ $maxWidth }) => $maxWidth || '12rem'};
  margin: 0 auto ${({ theme }) => theme.space[2]};
`;

const Art = styled(CoverImg)`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top;
  border-radius: ${({ theme, $radius }) => $radius || theme.radius.art};
  background: ${({ theme }) => theme.colors.surface2};
`;

// 경고 표시: 옅은 빨강 원 안의 빨간 세모(공통 WarnBadge)
const Warn = styled(WarnBadge)`
  margin-bottom: ${({ theme }) => theme.space[1]};
`;

// 제목과 부제(날짜)는 한 덩어리로 붙여 둔다
const Heading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
  color: ${({ $color, theme }) => $color || theme.colors.ink};
  overflow-wrap: anywhere;
  text-wrap: balance;
`;

// 부제(날짜): 흰 카드 위라 inkMuted(4.62:1)
const SubTitle = styled.p`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: ${({ theme }) => theme.text.sm};
  line-height: ${({ theme }) => theme.leading.tight};
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: ${({ theme }) => theme.text.base};
  line-height: 1.6;
  white-space: pre-line;
`;

// 버튼 줄: 기본은 가로로 나란히(자리가 모자라면 아래로), column이면 세로로 쌓는다
const ButtonContainer = styled.div`
  display: flex;
  flex-direction: ${({ $direction }) => ($direction === 'column' ? 'column' : 'row')};
  flex-wrap: ${({ $direction }) => ($direction === 'column' ? 'nowrap' : 'wrap')};
  gap: ${({ theme }) => theme.space[3]};
  align-self: stretch;
  margin-top: ${({ theme }) => theme.space[3]};

  /* 가로 줄에서만 폭을 나눠 갖는다(세로로 쌓을 때 flex-basis가 높이가 되지 않게) */
  & > * {
    flex: ${({ $direction }) => ($direction === 'column' ? 'none' : '1 1 7rem')};
    min-width: 0;
  }
`;

export default function PopCard({
  imageSrc,
  imageSize,
  cornerRadius,
  cardTitle,
  titleColor,
  subTitle,
  description,
  positiveBtnText,
  negativeBtnText,
  onPositiveClick,
  onNegativeClick,
  positivePadding, // 호환용(쓰지 않음): 버튼 크기는 RoundedButton이 정한다
  negativePadding, // 호환용(쓰지 않음)
  danger = false,
  useWarningIcon = false,
  fitContent = false, // 호환용(쓰지 않음): 높이는 늘 내용에 맞춘다
  buttonDirection,
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  return (
    <Panel
      $maxWidth="22rem"
      role="dialog"
      aria-labelledby={cardTitle ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
    >
      {imageSrc ? (
        <Frame $maxWidth={imageSize}>
          <Art src={imageSrc} alt="" $radius={cornerRadius} />
        </Frame>
      ) : useWarningIcon ? (
        <Warn />
      ) : null}

      {(cardTitle || subTitle) && (
        <Heading>
          {cardTitle && (
            <Title id={titleId} $color={titleColor}>
              {cardTitle}
            </Title>
          )}
          {subTitle && <SubTitle>{subTitle}</SubTitle>}
        </Heading>
      )}
      {description && <Description id={descId}>{description}</Description>}

      {(positiveBtnText || negativeBtnText) && (
        <ButtonContainer $direction={buttonDirection}>
          {positiveBtnText && (
            <RoundedButton type="button" $inline $primary={!danger} $danger={danger} onClick={onPositiveClick}>
              {positiveBtnText}
            </RoundedButton>
          )}
          {negativeBtnText && (
            <RoundedButton type="button" $inline onClick={onNegativeClick}>
              {negativeBtnText}
            </RoundedButton>
          )}
        </ButtonContainer>
      )}
    </Panel>
  );
}
