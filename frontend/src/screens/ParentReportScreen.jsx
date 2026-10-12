import React from 'react';
import styled from 'styled-components';
import { useRecoilValue } from 'recoil';
import { storyInfoState } from '../recoil/atoms';
import CategoryStatsChart from '../components/CategoryStatsChart';
import PageShell, { PageHeader } from '../components/PageShell';
import Card from '../components/Card';
import Empty from '../components/Empty';

const categories = ['genre', 'place', 'mood'];
const categoryNames = {
  genre: '장르',
  place: '장소',
  mood: '날씨',
};

function countFrequencies(storyInfo, categoryKey) {
  const freq = {};
  storyInfo.forEach(story => {
    const val = story[categoryKey];
    if (val) {
      freq[val] = (freq[val] || 0) + 1;
    }
  });
  return freq;
}

// 차트 카드 격자: 휴대폰 한 칸, 넓은 화면은 세 칸까지
const ChartGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(18rem, 100%), 1fr));
  gap: ${({ theme }) => theme.space[5]};
`;

const ChartCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

// 기록이 없는 항목: 가짜 예시 차트 대신 차트 자리에 짧은 안내. 제목은 차트 제목과 같은 h2
const SlotTitle = styled.h2`
  margin-bottom: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.ink};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.semibold};
  text-align: center;
`;

const SlotEmpty = styled.p`
  flex: 1;
  display: grid;
  place-items: center;
  padding: ${({ theme }) => `${theme.space[6]} 0`};
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
`;

const ParentReportScreen = () => {
  const storyInfo = useRecoilValue(storyInfoState);
  const stats = categories.map(key => ({ key, data: countFrequencies(storyInfo, key) }));
  const hasData = (data) => Object.keys(data).length > 0;

  return (
    <PageShell $nav={false}>
      <PageHeader title="부모 리포트" subTitle="아이의 선택 경향을 카테고리별로 확인해보세요." />
      {stats.some(({ data }) => hasData(data)) ? (
        <ChartGrid>
          {stats.map(({ key, data }) => (
            <ChartCard key={key}>
              {hasData(data) ? (
                <CategoryStatsChart title={`${categoryNames[key]} 통계`} data={data} />
              ) : (
                <>
                  <SlotTitle>{`${categoryNames[key]} 통계`}</SlotTitle>
                  <SlotEmpty>아직 기록이 없어요</SlotEmpty>
                </>
              )}
            </ChartCard>
          ))}
        </ChartGrid>
      ) : (
        <Empty title="아직 모인 기록이 없어요" description="동화를 만들면 아이가 고른 장르와 장소가 여기에 모여요." />
      )}
    </PageShell>
  );
};

export default ParentReportScreen;
