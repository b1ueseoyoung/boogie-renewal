import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import styled, { useTheme } from 'styled-components';

// 바깥 간격은 부모(리포트의 카드 격자)가 정한다
const ChartWrapper = styled.div`
  min-width: 0;
`;

// 리포트 h1 아래의 첫 단계 제목. 차트 카드의 제목이라 semibold
const ChartTitle = styled.h2`
  text-align: center;
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.semibold};
  margin-bottom: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.ink};
`;

const CategoryStatsChart = ({ title, data }) => {
  const theme = useTheme();
  // 차트 색(theme.chart): 파랑 중심 8색. 모두 흰 바탕 대비 3:1 이상
  const COLORS = theme.chart;
  const hasData = data && Object.keys(data).length > 0;

  // 기록이 없을 때 가짜 '예시' 조각을 그리지 않는다. 빈 기록은 부르는 화면이 안내한다(ParentReportScreen)
  const chartData = hasData ? Object.entries(data).map(([name, count]) => ({ name, value: count })) : [];

  // 말풍선: 흰 카드 + 가는 테두리 + 옅은 그림자(차트 위에 떠 있다), 본문 글꼴
  const tooltipBox = {
    background: theme.colors.surface,
    border: theme.border.card,
    borderRadius: theme.radius.tag,
    boxShadow: theme.shadow.cardHover,
    fontFamily: theme.fonts.body,
    fontSize: theme.text.sm,
    color: theme.colors.ink,
  };

  return (
    <ChartWrapper>
      <ChartTitle>{title}</ChartTitle>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            fill={COLORS[0]}
            stroke={theme.colors.surface}
            strokeWidth={2}
            label={{ fill: theme.colors.ink, fontFamily: theme.fonts.body, fontSize: 14 }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipBox}
            labelStyle={{ color: theme.colors.inkSoft }}
            itemStyle={{ color: theme.colors.ink, fontWeight: theme.weight.semibold }}
          />
          {/* 범례 글자는 조각 색 대신 ink로 쓴다 */}
          <Legend
            iconType="circle"
            formatter={(value) => (
              <span style={{ color: theme.colors.ink, fontFamily: theme.fonts.body }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};

export default CategoryStatsChart;
