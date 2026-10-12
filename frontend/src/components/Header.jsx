import styled from 'styled-components';
import { PageHeader } from './PageShell';

// 예전 목록 화면용 호환 래퍼. 흰 띠 대신 PageShell의 PageHeader(큰 굵은 제목)를 바탕 위에 바로 그린다.
// 새 화면은 <PageShell><PageHeader title=… /></PageShell>을 쓴다(PageShell 안에서는 이 래퍼가 필요 없다).
// 래퍼는 PageShell과 같은 폭·좌우 여백을 두고, 넓은 화면에서는 위 메뉴 막대 자리를 비운다.
const Wrap = styled.div`
  width: min(100%, ${({ theme }) => theme.layout.page});
  margin-inline: auto;
  padding: ${({ theme }) => `calc(env(safe-area-inset-top) + ${theme.space[6]}) ${theme.layout.gutter} 0`};

  @media ${({ theme }) => theme.mq.wide} {
    padding-top: calc(${({ theme }) => theme.layout.navHWide} + ${({ theme }) => theme.space[7]});
  }
`;

export default function Header({ pageName, subTitle, actions, eyebrow }) {
  return (
    <Wrap>
      <PageHeader title={pageName} subTitle={subTitle} actions={actions} eyebrow={eyebrow} />
    </Wrap>
  );
}
