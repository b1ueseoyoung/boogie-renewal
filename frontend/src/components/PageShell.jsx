import React from 'react';
import styled, { css } from 'styled-components';
import { rise } from './Card';

// 목록 화면(책장·즐겨찾기·내 캐릭터·책장 편집·부모 리포트·설정)의 공통 틀. <main>으로 그리므로 화면 안에 main을 또 두지 않는다.
// 메뉴 막대(BottomNav) 자리만큼 위(넓은 화면)·아래(휴대폰) 여백을 둔다. 막대가 없는 경로(책장 편집, 부모 리포트)는 $nav={false}. 쓰는 법:
// <PageShell><PageHeader title="내 책장" subTitle="만든 동화 12권" actions={<RoundedButton $size="sm" $inline>편집</RoundedButton>} /><ShelfGrid>…</ShelfGrid></PageShell>

const PageShell = styled.main`
  width: min(100%, ${({ theme }) => theme.layout.page});
  min-height: calc(var(--vh, 1vh) * 100);
  margin: 0 auto;
  padding-inline: ${({ theme }) => theme.layout.gutter};
  /* 휴대폰: 위에는 막대가 없고, 아래 탭 막대 + 홈 막대(safe-area) 자리를 비운다 */
  padding-top: calc(env(safe-area-inset-top) + ${({ theme }) => theme.space[6]});
  padding-bottom: calc(
    ${({ theme }) => theme.layout.navH} + env(safe-area-inset-bottom) + ${({ theme }) => theme.space[7]}
  );
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  /* 넓은 화면: 위 막대 자리를 비운다 */
  @media ${({ theme }) => theme.mq.wide} {
    padding-top: calc(${({ theme }) => theme.layout.navHWide} + ${({ theme }) => theme.space[7]});
    padding-bottom: ${({ theme }) => theme.space[8]};
  }

  /* 막대가 없는 화면: 막대 자리 없이 같은 여백 리듬만 둔다 */
  ${({ $nav, theme }) =>
    $nav === false &&
    css`
      padding-bottom: calc(env(safe-area-inset-bottom) + ${theme.space[7]});

      @media ${theme.mq.wide} {
        padding-top: calc(env(safe-area-inset-top) + ${theme.space[7]});
        padding-bottom: ${theme.space[8]};
      }
    `}
`;

const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => `${theme.space[4]} ${theme.space[5]}`};
  margin-bottom: ${({ theme }) => theme.space[6]};

  @media ${({ theme }) => theme.mq.wide} {
    margin-bottom: ${({ theme }) => theme.space[7]};
  }
`;

const HeadText = styled.div`
  flex: 1 1 18rem;
  min-width: 0;
`;

// 제목 위 작은 이름표: 옅은 파랑 배지(accentDeep 글자 7.1:1)
const Eyebrow = styled.p`
  display: inline-block;
  margin-bottom: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => `0.125rem ${theme.space[3]}`};
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.accentPale};
  color: ${({ theme }) => theme.colors.accentDeep};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.caption};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: 1.6;
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.text['3xl']};
  color: ${({ theme }) => theme.colors.ink};
  text-wrap: balance;
  overflow-wrap: anywhere;
`;

const Sub = styled.p`
  max-width: 40ch;
  margin-top: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: ${({ theme }) => theme.text.lg};
  line-height: 1.6;
`;

// 오른쪽 버튼 자리. 휴대폰처럼 좁으면 제목 아래로 내려간다
const HeadActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
`;

export function PageHeader({ title, subTitle, actions, eyebrow }) {
  return (
    <Head>
      <HeadText>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Title>{title}</Title>
        {subTitle && <Sub>{subTitle}</Sub>}
      </HeadText>
      {actions && <HeadActions>{actions}</HeadActions>}
    </Head>
  );
}

// 책·캐릭터 카드 격자. 휴대폰 2칸, 1280px 5칸 정도. 항목이 적어도 칸을 늘리지 않고 왼쪽부터 채운다(auto-fill)
export const ShelfGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(10.5rem, 42vw), 1fr));
  gap: ${({ theme }) => `${theme.space[6]} ${theme.space[5]}`};
  align-items: start;

  @media ${({ theme }) => theme.mq.phone} {
    gap: ${({ theme }) => `${theme.space[5]} ${theme.space[4]}`};
  }
`;

export default PageShell;
