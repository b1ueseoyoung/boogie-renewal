import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { Overlay, DialogCard } from './Card';

// 공통 대화상자. open일 때만 그린다. Escape·막 누르기(closeOnScrim, 기본 true)로 onClose를 부르고,
// 열리면 첫 버튼(autoFocus를 준 버튼이 있으면 그 버튼)에 포커스, 닫히면 연 자리로 포커스를 돌려준다.
// 예) <Dialog open={Boolean(story)} onClose={close} title={story?.title} media={<PaperFrame>…</PaperFrame>}
//       actions={<><RoundedButton $primary onClick={read}>열기</RoundedButton><RoundedButton onClick={close}>닫기</RoundedButton></>}>본문</Dialog>
// 그 밖: maxWidth(기본 24rem), label(보이는 제목이 없을 때), align('center' | 'start').
// 버튼은 폭을 다 쓰고 주요 → 보조 순서로 세로로 쌓는다(긴 문구도 줄바꿈 없이, 누를 자리는 크게).
// 버튼으로만 닫아야 하는 대화상자는 onClose를 넘기지 않는다. 그러면 Escape와 막 누르기를 모두 무시한다.

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const Panel = styled(DialogCard)`
  text-align: ${({ $align }) => ($align === 'start' ? 'start' : 'center')};
`;

const Media = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.text['2xl']};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
  text-wrap: balance;
`;

const Body = styled.div`
  color: ${({ theme }) => theme.colors.inkSoft};
  font-size: ${({ theme }) => theme.text.base};
  line-height: ${({ theme }) => theme.leading.body};

  * + & {
    margin-top: ${({ theme }) => theme.space[3]};
  }

  & > * + * {
    margin-top: ${({ theme }) => theme.space[2]};
  }
`;

// 버튼 자리: 세로로 쌓는다. 공용 버튼의 폭·바깥 여백(& + & 위 여백 포함)보다 우선해야 해서 클래스를 세 번 적는다
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};

  * + & {
    margin-top: ${({ theme }) => theme.space[6]};
  }

  &&& > * {
    width: 100%;
    max-width: none;
    margin: 0;
  }
`;

function DialogPanel({ onClose, title, label, children, actions, media, closeOnScrim = true, maxWidth, align }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;
  const cardRef = useRef(null);
  const actionsRef = useRef(null);
  const downOnScrim = useRef(false);
  const onCloseRef = useRef(onClose);
  // 연 자리: 첫 그리기 때(autoFocus가 포커스를 옮기기 전) 기억해 둔다
  const [opener] = useState(() => document.activeElement);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // 열리면 안으로 포커스를 옮기고, 닫히면(사라지면) 연 자리로 돌려준다
  useEffect(() => {
    const card = cardRef.current;
    if (card && !card.contains(document.activeElement)) {
      const target =
        actionsRef.current?.querySelector('button:not([disabled]), [href]') || card.querySelector(FOCUSABLE) || card;
      target.focus();
    }
    return () => {
      if (opener && opener !== document.body && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [opener]);

  // Escape로 닫고, Tab은 대화상자 안에서만 돈다
  useEffect(() => {
    const onKeyDown = (e) => {
      const card = cardRef.current;
      if (!card) return;
      if (e.key === 'Escape') {
        if (onCloseRef.current) {
          e.preventDefault();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(card.querySelectorAll(FOCUSABLE));
      const active = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const outside = active === card || !card.contains(active);
      if (e.shiftKey && (outside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // 막에서 누르기 시작해 막에서 뗀 경우만 닫는다(카드 안에서 끌다가 밖에서 떼면 닫지 않는다)
  const handlePointerDown = (e) => {
    downOnScrim.current = e.target === e.currentTarget;
  };
  const handleClick = (e) => {
    if (closeOnScrim && downOnScrim.current && e.target === e.currentTarget && onClose) onClose();
    downOnScrim.current = false;
  };

  return createPortal(
    <Overlay onPointerDown={handlePointerDown} onClick={handleClick}>
      <Panel
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        aria-describedby={children ? bodyId : undefined}
        tabIndex={-1}
        $maxWidth={maxWidth}
        $align={align}
      >
        {media && <Media>{media}</Media>}
        {title && <Title id={titleId}>{title}</Title>}
        {children && <Body id={bodyId}>{children}</Body>}
        {actions && <Actions ref={actionsRef}>{actions}</Actions>}
      </Panel>
    </Overlay>,
    document.body
  );
}

export default function Dialog({ open, ...props }) {
  if (!open) return null;
  return <DialogPanel {...props} />;
}
