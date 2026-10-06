import React from 'react';
import styled, { keyframes } from 'styled-components';

const WIDE = '52.0625rem';

// 화면이 열릴 때 아래에서 살짝 떠오른다. 이야기 장면이 바뀔 때도 같이 쓴다
export const rise = keyframes`
  from {
    opacity: 0;
    translate: 0 0.75rem;
  }
`;

// 카드를 화면 세로 가운데에 둔다. 내용이 길면 위에서부터 자연스럽게 늘어난다
const Page = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(74rem, 100%);
  min-height: calc(var(--vh, 1vh) * 100);
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space[5]} ${theme.space[4]} ${theme.space[6]}`};

  /* 넓은 화면에서는 위쪽 메뉴 막대(BottomNav)만큼 띄운다 */
  @media (min-width: 56rem) {
    padding-top: 5.5rem;
  }
`;

// 종이 카드: 둥근 모서리와 부드러운 그림자로 바탕에서 띄운다. $bare면 카드 없이 바탕 위에 바로 놓는다(이야기 화면)
const Screen = styled.section`
  background: ${({ theme, $bare }) => ($bare ? 'transparent' : theme.colors.surface)};
  border-radius: ${({ theme }) => theme.radius.card};
  box-shadow: ${({ theme, $bare }) => ($bare ? 'none' : theme.shadow.card)};
  padding: ${({ theme, $bare }) => ($bare ? 0 : `${theme.space[7]} ${theme.space[7]}`)};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  @media (max-width: 40rem) {
    padding: ${({ theme, $bare }) => ($bare ? 0 : `${theme.space[6]} ${theme.space[5]}`)};
  }
`;

// 화면 제목과 진행 점을 한 줄에 둔다
const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[3]};
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const Progress = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  margin-left: auto;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Step = styled.span`
  white-space: nowrap;
`;

// 진행 표시: 단계마다 점 하나. 지난 단계는 해 색, 지금 단계는 파란 알약
export const Dots = styled.span`
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
`;

export const Dot = styled.span`
  display: block;
  width: ${({ $now }) => ($now ? '1.5rem' : '0.625rem')};
  height: 0.625rem;
  border-radius: 999px;
  background: ${({ theme, $now, $done }) => ($now ? theme.colors.accent : $done ? theme.colors.sun : theme.colors.line)};
  transition: width ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
`;

export const StepDots = ({ current, total }) => (
  <Dots role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}>
    {Array.from({ length: total }, (_, i) => (
      <Dot key={i} $done={i + 1 < current} $now={i + 1 === current} />
    ))}
  </Dots>
);

const Split = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[5]};
  align-items: start;
  grid-template-columns: 1fr;

  @media (min-width: ${WIDE}) {
    grid-template-columns: ${({ $hasAside }) =>
      $hasAside ? 'minmax(min(18rem, 100%), 1.1fr) minmax(min(17rem, 100%), 1fr)' : '1fr'};
  }
`;

const Aside = styled.div`
  min-width: 0;

  @media (min-width: ${WIDE}) {
    grid-column: 1;
    grid-row: 1;
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  min-width: 0;

  @media (min-width: ${WIDE}) {
    grid-column: ${({ $hasAside }) => ($hasAside ? 2 : 1)};
    grid-row: 1;
  }
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.text['3xl']};
  white-space: pre-line;
  overflow-wrap: anywhere;
  min-width: 0;
`;

const SubTitle = styled.p`
  font-size: ${({ theme }) => theme.text.lg};
  color: ${({ theme }) => theme.colors.inkSoft};
  max-width: 46ch;
  white-space: pre-line;
`;

const Content = styled.div`
  width: 100%;
`;

// 사진과 삽화 자리: 테두리 없이 해 색 원 위에 그림을 올린다
export const PaperFrame = styled.figure`
  position: relative;
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth || '20rem'};
  margin: ${({ theme }) => theme.space[3]} auto 0;
  padding: ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.sunPale};
  border-radius: ${({ theme }) => theme.radius.card};
`;

const Art = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme, $fill }) => ($fill ? theme.colors[$fill] : 'none')};
`;

const BaseScreenLayout = ({
  progressText,
  progressCurrent,
  progressTotal,
  title,
  subTitle,
  children,
  aside,
  imageSrc,
  imageAlt = '',
  imageWidth = 320,
  imageFill, // 투명 바탕 그림 뒤에 깔 theme.colors 키. 흰 그림이 흰 틀에 묻힐 때만 쓴다
  bare = false, // 카드 없이 바탕 위에 바로 놓는다(이야기 진행, 읽기)
}) => {
  const asideNode =
    aside ||
    (imageSrc ? (
      <PaperFrame $maxWidth={`${imageWidth / 16}rem`}>
        <Art src={imageSrc} alt={imageAlt} $fill={imageFill} />
      </PaperFrame>
    ) : null);
  const hasAside = Boolean(asideNode);

  return (
    <Page>
      <Screen $bare={bare}>
        {(title || (progressText || (progressCurrent && progressTotal))) && (
          <Head>
            {title && <Title>{title}</Title>}
            {(progressText || (progressCurrent && progressTotal)) && (
              <Progress>
                {progressText && <Step aria-current="step">{progressText}</Step>}
                {progressCurrent !== undefined && progressTotal !== undefined && (
                  <StepDots current={progressCurrent} total={progressTotal} />
                )}
              </Progress>
            )}
          </Head>
        )}

        <Split $hasAside={hasAside}>
          <Stack $hasAside={hasAside}>
            {subTitle && <SubTitle>{subTitle}</SubTitle>}
            <Content>{children}</Content>
          </Stack>
          {hasAside && <Aside>{asideNode}</Aside>}
        </Split>
      </Screen>
    </Page>
  );
};

export default BaseScreenLayout;
