import React from 'react';
import styled from 'styled-components';
import { rise } from './Card';

// 화면이 열릴 때 아래에서 살짝 떠오른다. 이야기 장면이 바뀔 때도 같이 쓴다(Card.jsx 와 같은 움직임)
export { rise };

// 카드를 화면 세로 가운데에 둔다. 내용이 길면 위에서부터 자연스럽게 늘어난다.
// $nav: 메뉴 막대 자리. 흐름·로그인 화면에는 막대가 없어서 기본은 비우지 않는다. true면 넓은 화면 위와 휴대폰 아래 탭 자리를 비운다.
const Page = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(${({ theme, $maxWidth }) => $maxWidth || theme.layout.page}, 100%);
  min-height: calc(var(--vh, 1vh) * 100);
  margin: 0 auto;
  padding: ${({ theme }) => `calc(env(safe-area-inset-top) + ${theme.space[5]}) ${theme.layout.gutter} ${theme.space[6]}`};

  ${({ theme, $nav }) =>
    $nav === true &&
    `
    @media ${theme.mq.narrow} {
      padding-bottom: calc(${theme.layout.navH} + env(safe-area-inset-bottom) + ${theme.space[5]});
    }
  `}

  ${({ theme, $nav }) =>
    $nav === true &&
    `
    @media ${theme.mq.wide} {
      padding-top: calc(${theme.layout.navHWide} + ${theme.space[5]});
    }
  `}
`;

// 흰 카드: 그림자 없이 가는 테두리로 바탕과 나눈다. $bare면 카드 없이 바탕 위에 바로 놓는다(이야기 화면)
const Screen = styled.section`
  background: ${({ theme, $bare }) => ($bare ? 'transparent' : theme.colors.surface)};
  border: ${({ theme, $bare }) => ($bare ? 'none' : theme.border.card)};
  border-radius: ${({ theme }) => theme.radius.card};
  box-shadow: ${({ theme, $bare }) => ($bare ? 'none' : theme.shadow.card)};
  padding: ${({ theme, $bare }) => ($bare ? 0 : theme.space[7])};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  @media ${({ theme }) => theme.mq.phone} {
    padding: ${({ theme, $bare }) => ($bare ? 0 : `${theme.space[6]} ${theme.space[5]}`)};
  }
`;

// 카드 맨 위 상표 자리(로그인·가입의 AuthBrand)
const Brand = styled.div`
  margin-bottom: ${({ theme }) => theme.space[5]};

  &:empty {
    display: none;
  }
`;

// 화면 제목과 진행 표시. 자리가 모자라면(휴대폰의 두 줄 제목) 진행 표시가 제목 아래로 내려간다
const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

// 머리줄 왼쪽 묶음: 나가기 버튼(headStart) + 화면 제목. 제목이 길면 이 묶음 안에서 줄을 바꾼다
const HeadMain = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 0;
`;

// 진행 표시가 혼자 있으면(제목 없는 이야기 화면) 오른쪽 끝에 둔다. 제목과 함께라면 줄이 바뀌었을 때 왼쪽에서 시작한다
const Progress = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  margin-left: ${({ $alone }) => ($alone ? 'auto' : '0')};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: ${({ theme }) => theme.weight.medium};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Step = styled.span`
  white-space: nowrap;
`;

// 진행 표시: 단계마다 점 하나. 지금 단계는 파란 알약, 지난 단계는 옅은 파랑(accentTrack), 남은 단계는 회색(lineStrong)
export const Dots = styled.span`
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
`;

export const Dot = styled.span`
  display: block;
  width: ${({ $now }) => ($now ? '1.5rem' : '0.625rem')};
  height: 0.625rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $now, $done }) =>
    $now ? theme.colors.accent : $done ? theme.colors.accentTrack : theme.colors.lineStrong};
  transition: width ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
`;

export const StepDots = ({ current, total, label = '진행 단계', valueText }) => (
  <Dots
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={total}
    aria-valuenow={current}
    aria-valuetext={valueText}
  >
    {Array.from({ length: total }, (_, i) => (
      <Dot key={i} $done={i + 1 < current} $now={i + 1 === current} />
    ))}
  </Dots>
);

// 넓으면 그림(왼쪽) | 글(오른쪽), 좁으면 그림 → 글. 마크업도 그림이 먼저라 읽는 순서와 포커스 순서가 보이는 순서와 같다
const Split = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[5]};
  align-items: start;
  grid-template-columns: 1fr;

  @media ${({ theme }) => theme.mq.wide} {
    gap: ${({ theme }) => theme.space[7]};
    grid-template-columns: ${({ $hasAside }) =>
      $hasAside ? 'minmax(min(18rem, 100%), 1.1fr) minmax(min(17rem, 100%), 1fr)' : '1fr'};
  }
`;

const Aside = styled.div`
  min-width: 0;

  /* 좁은 화면: 그림을 줄여 첫 화면 안에 버튼까지 보이게 한다 */
  @media ${({ theme }) => theme.mq.narrow} {
    & > figure {
      max-width: min(100%, 15rem);
    }

    /* 넓은 화면에서만 보이는 그림(Mascot)만 있으면 빈 줄과 간격을 남기지 않는다 */
    &:has(> [data-wide-only]:only-child) {
      display: none;
    }
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
  min-width: 0;
`;

const Title = styled.h1`
  flex: 1 1 15rem;
  min-width: 0;
  font-size: ${({ theme }) => theme.text['3xl']};
  white-space: pre-line;
  overflow-wrap: anywhere;
  text-wrap: balance;
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

// 사진과 삽화 자리: 테두리 없이 옅은 회색 판(surface2) 위에 그림을 올린다
export const PaperFrame = styled.figure`
  position: relative;
  width: 100%;
  max-width: ${({ $maxWidth }) => $maxWidth || '20rem'};
  margin: ${({ theme }) => theme.space[3]} auto 0;
  padding: ${({ theme }) => theme.space[3]};
  background: ${({ theme }) => theme.colors.surface2};
  border-radius: ${({ theme }) => theme.radius.card};
`;

// 도깨비 그림 뒤의 옅은 파랑 원(이름 SunDisc는 예전 그대로). 대기·빈 상태·로그인 같은 순간에 쓴다. 안의 그림은 원 폭의 $fill(기본 80%)
// 예) <SunDisc $size="10rem"><img src={dokkaebi} alt="" /></SunDisc>
export const SunDisc = styled.span`
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: ${({ $size }) => $size || '10rem'};
  aspect-ratio: 1;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accentPale};

  & > img {
    display: block;
    grid-area: 1 / 1;
    width: ${({ $fill }) => $fill || '80%'};
    height: auto;
  }
`;

const Art = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme, $fill }) => ($fill ? theme.colors[$fill] : 'none')};
`;

// 진행 표시: progressCurrent·progressTotal을 주면 "2 / 3"(progressUnit="장"이면 "2장 / 5장") 글자와 점을 함께 그린다.
// progressText는 숫자가 아닌 상태 글자(예: "이야기 생성 중")를 보일 때만 준다.
const BaseScreenLayout = ({
  progressText,
  progressCurrent,
  progressTotal,
  progressUnit = '',
  title,
  subTitle,
  children,
  aside,
  imageSrc,
  imageAlt = '',
  imageWidth = 320,
  imageFill, // 투명 바탕 그림 뒤에 깔 theme.colors 키. 흰 그림이 흰 틀에 묻힐 때만 쓴다
  bare = false, // 카드 없이 바탕 위에 바로 놓는다(이야기 진행, 읽기)
  nav = false, // 메뉴 막대 자리: 막대가 있는 경로(BottomNav의 navItems)에서만 true. 지금 그런 화면은 PageShell을 쓴다
  maxWidth, // 페이지 폭(기본 theme.layout.page). 한 열짜리 짧은 화면은 '48rem'처럼 줄인다
  brand, // 카드 맨 위에 둘 상표(로그인·가입의 <AuthBrand />)
  headStart, // 머리줄 맨 왼쪽, 제목 앞에 둘 노드(읽기 화면의 '홈으로' 버튼)
}) => {
  const asideNode =
    aside ||
    (imageSrc ? (
      <PaperFrame $maxWidth={`${imageWidth / 16}rem`}>
        <Art src={imageSrc} alt={imageAlt} $fill={imageFill} />
      </PaperFrame>
    ) : null);
  const hasAside = Boolean(asideNode);
  const hasCount = Boolean(progressCurrent && progressTotal);
  const stepText = progressText || (hasCount ? `${progressCurrent}${progressUnit} / ${progressTotal}${progressUnit}` : '');
  const hasProgress = Boolean(stepText);

  return (
    <Page $nav={nav} $maxWidth={maxWidth}>
      <Screen $bare={bare}>
        {brand && <Brand>{brand}</Brand>}
        {(title || hasProgress || headStart) && (
          <Head>
            {(headStart || title) && (
              <HeadMain>
                {headStart}
                {title && <Title>{title}</Title>}
              </HeadMain>
            )}
            {hasProgress && (
              <Progress $alone={!title && !headStart}>
                <Step aria-current="step">{stepText}</Step>
                {hasCount && <StepDots current={progressCurrent} total={progressTotal} valueText={stepText} />}
              </Progress>
            )}
          </Head>
        )}

        <Split $hasAside={hasAside}>
          {hasAside && <Aside>{asideNode}</Aside>}
          <Stack>
            {subTitle && <SubTitle>{subTitle}</SubTitle>}
            <Content>{children}</Content>
          </Stack>
        </Split>
      </Screen>
    </Page>
  );
};

export default BaseScreenLayout;
