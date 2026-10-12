import React from 'react';
import styled from 'styled-components';
import { BsExclamationTriangleFill } from 'react-icons/bs';
import Card from './Card';
import RoundedButton from './RoundedButton';

// 경고 배지: 옅은 빨강 원 안의 채운 빨간 세모. 오류 카드, 삭제 확인처럼 조심할 순간에 쓴다(장식이라 읽히지 않는다).
// 바깥 여백은 쓰는 쪽이 정한다. 예) const Badge = styled(WarnBadge)`margin-bottom: …`
const Badge = styled.span`
  display: grid;
  place-items: center;
  flex: none;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.redpenPale};
  color: ${({ theme }) => theme.colors.redpen};

  & svg {
    width: 1.75rem;
    height: 1.75rem;
  }
`;

export function WarnBadge({ className }) {
  return (
    <Badge className={className} aria-hidden="true">
      <BsExclamationTriangleFill />
    </Badge>
  );
}

// 화면 안의 불러오기 실패: 흰 카드 위 경고 배지 → 제목 → 안내(있으면) → 주요 버튼 하나.
// 빈 상태(Empty, 갸웃하는 도깨비)와 구분된다. Empty는 정말 비어 있을 때만 쓴다.
// 예) <LoadError title="책장을 불러오지 못했어요." description="잠시 뒤 다시 시도해 주세요." actionText="다시 시도" onAction={fetchData} />
const Panel = styled(Card)`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  width: min(100%, 28rem);
  margin: ${({ theme }) => `${theme.space[6]} auto 0`};
  text-align: center;
`;

const Mark = styled(WarnBadge)`
  margin-bottom: ${({ theme }) => theme.space[1]};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
  text-wrap: balance;
`;

const Text = styled.p`
  color: ${({ theme }) => theme.colors.inkSoft};
  text-wrap: balance;
`;

const Action = styled.div`
  padding-top: ${({ theme }) => theme.space[3]};
`;

export function LoadError({ title, description, actionText, onAction }) {
  return (
    <Panel role="alert" $pad="lg">
      <Mark />
      <Title>{title}</Title>
      {description && <Text>{description}</Text>}
      {actionText && (
        <Action>
          <RoundedButton type="button" $primary $inline onClick={onAction}>
            {actionText}
          </RoundedButton>
        </Action>
      )}
    </Panel>
  );
}
