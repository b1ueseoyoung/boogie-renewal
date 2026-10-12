import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import RoundedButton from './RoundedButton';
import { Overlay, DialogCard } from './Card';
import { WarnBadge } from './Notice';

// 오류 카드: 막 위의 흰 카드. 위에 옅은 빨강 원 안의 빨간 경고 표시, 아래에 안내 문구와 할 일 버튼 하나
const Panel = styled(DialogCard)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

const Badge = styled(WarnBadge)`
  margin-bottom: ${({ theme }) => theme.space[4]};
`;

const Text = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: 1.5;
  letter-spacing: ${({ theme }) => theme.tracking.body};
  color: ${({ theme }) => theme.colors.ink};
  text-wrap: balance;
`;

const Nowrap = styled.span`
  white-space: nowrap;
`;

const Action = styled(RoundedButton)`
  &&& {
    margin-top: ${({ theme }) => theme.space[6]};
  }
`;

const MESSAGES = {
  declined: '이 사진으로는 그림을 만들 수 없어요. 다른 사진으로 다시 해 볼까요?',
  timeout: '그림이 늦어지고 있어요. 다시 시도해 볼까요?',
  no_image: '그림이 늦어지고 있어요. 다시 시도해 볼까요?',
  replay_miss: '지금은 저장된 동화만 볼 수 있어요.',
  error: '문제가 생겼어요. 다시 시도해 주세요.',
  duplicate_name: '같은 이름의 주인공이 이미 있어요. 다른 이름을 써 주세요.',
  candidate_limit: '후보는 세 개까지 만들 수 있어요. 이 중에서 골라 주세요.',
  character_not_approved: '먼저 캐릭터를 골라 주세요.',
  no_active_story: '진행 중인 이야기가 없어요. 처음부터 다시 시작해 주세요.',
};

function formatResetsAt(resetsAt) {
  if (!resetsAt) return '한도가 풀린 뒤';
  const at = new Date(resetsAt * 1000);
  const hours = String(at.getHours()).padStart(2, '0');
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${at.getMonth() + 1}월 ${at.getDate()}일 ${hours}:${minutes}`;
}

function messageFor(error, scene) {
  const errorClass = error && error.errorClass;
  if (errorClass === 'limit') {
    const resetsAt = formatResetsAt(error.resetsAt);
    return <>오늘은 도깨비가 그림을 다 그렸어요. <Nowrap>{resetsAt} 이후에</Nowrap> <Nowrap>다시 만들 수 있어요.</Nowrap> 저장된 동화는 책장에서 <Nowrap>볼 수 있어요.</Nowrap></>;
  }
  if (errorClass === 'declined' && scene) {
    return <>이 장면은 그림으로 그릴 수 없어요. 다른 걸 <Nowrap>골라 볼까요?</Nowrap></>;
  }
  if (errorClass === 'declined') {
    return <>이 사진으로는 그림을 만들 수 없어요. 다른 사진으로 <Nowrap>다시 해 볼까요?</Nowrap></>;
  }
  if (errorClass === 'timeout' || errorClass === 'no_image') {
    return <>그림이 늦어지고 있어요. <Nowrap>다시 시도해 볼까요?</Nowrap></>;
  }
  if (errorClass === 'error' && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return MESSAGES[errorClass] || MESSAGES.error;
}

// 다시 시도할 수 없는 오류는 카드가 안내한 곳으로 가는 버튼을 준다. to가 없으면 카드만 닫는다(onClose).
function actionFor(error, scene) {
  const errorClass = error && error.errorClass;
  if (errorClass === 'limit' || errorClass === 'replay_miss') return { label: '책장으로', to: '/bookshelf' };
  if (errorClass === 'declined') return scene ? { label: '다른 걸 고를래요' } : { label: '다른 사진 고르기', to: '/create-character' };
  if (errorClass === 'no_active_story') return { label: '처음으로', to: '/' };
  return { label: '확인' };
}

// scene: 이야기 단계(첫 장면, 다음 장면)의 오류. declined 문구가 사진이 아니라 장면을 말한다.
export default function GenerationError({ error, onRetry, onClose, scene = false }) {
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const retryable = Boolean(error && error.retryable);
  const action = retryable ? null : actionFor(error, scene);

  // 열리면 포커스를 카드의 버튼으로 옮기고, 닫히면 원래 자리(남아 있으면)로 돌려준다.
  // 카드 버튼을 마우스나 Enter로 눌러 닫으면 그 이벤트 안에서 부른 focus()를 Chrome이 무시해서, 이벤트가 끝난 뒤로 미룬다.
  useEffect(() => {
    const before = document.activeElement;
    if (buttonRef.current) buttonRef.current.focus();
    return () => {
      setTimeout(() => {
        if (before && before.isConnected) before.focus();
      }, 0);
    };
  }, []);

  const handleAction = () => {
    if (onClose) onClose();
    if (action.to && action.to !== window.location.pathname) navigate(action.to);
  };

  return (
    <Overlay role="alert">
      <Panel $maxWidth="24rem">
        <Badge />
        <Text>{messageFor(error, scene)}</Text>
        {retryable && (
          <Action ref={buttonRef} type="button" $primary onClick={onRetry}>
            다시 시도
          </Action>
        )}
        {action && (action.to || onClose) && (
          <Action ref={buttonRef} type="button" $primary onClick={handleAction}>
            {action.label}
          </Action>
        )}
      </Panel>
    </Overlay>
  );
}
