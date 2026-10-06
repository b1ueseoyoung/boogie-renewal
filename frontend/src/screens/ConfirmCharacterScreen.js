import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { characterInfoState } from '../recoil/atoms';
import BaseScreenLayout, { PaperFrame } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import { getCandidates, regenerateCandidate, approveCandidate } from '../api/character';

const MAX_CANDIDATES = 3;
const ORDINALS = ['첫 번째', '두 번째', '세 번째'];
const WAITING = {
  regenerate: '도깨비가 주인공을 다시 그리고 있어요',
  approve: '도깨비가 주인공을 기억하고 있어요',
};

const Compare = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[6]};
  grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 20rem));
  justify-content: center;
  margin-top: ${({ theme }) => theme.space[3]};
`;

// 시안 C: 사진과 후보는 기울기 없이 흰 칸 위에 나란히 둔다(닮음 판단)
const Frame = PaperFrame;

const Art = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: contain;
  border-radius: ${({ theme }) => theme.radius.tag};
`;

const Caption = styled.figcaption`
  margin-top: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
`;

const SectionLabel = styled.p`
  margin-top: ${({ theme }) => theme.space[6]};
  margin-bottom: ${({ theme }) => theme.space[3]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Thumbs = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
  grid-template-columns: repeat(auto-fit, minmax(min(7.5rem, 45%), 11rem));

  /* auto-fit counts tracks by the 11rem maximum, which leaves one column on a phone; two columns there */
  @media (max-width: 30rem) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Thumb = styled.button`
  position: relative;
  padding: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.tap};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.inkSoft};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.card};
  cursor: pointer;
  transition: background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.colors.accentPale};
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const ThumbArt = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.tag};
`;

const ThumbLabel = styled.span`
  display: block;
  margin-top: ${({ theme }) => theme.space[1]};
  text-align: center;
`;

const Check = styled.span`
  position: absolute;
  top: ${({ theme }) => theme.space[2]};
  right: ${({ theme }) => theme.space[2]};
  display: grid;
  place-items: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accentInk};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[6]};

  /* 시안의 .row: 버튼을 한 줄에 놓는다. &&는 RoundedButton의 "& + &" 간격 규칙보다 우선하기 위한 것이다. */
  && > ${RoundedButton} {
    flex: 1 1 14rem;
    width: auto;
    margin: 0;
  }
`;

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function ConfirmCharacterScreen() {
  const navigate = useNavigate();
  const [characterInfo, setCharacterInfo] = useRecoilState(characterInfoState);
  const character = characterInfo[0] || {};
  const { charId, userImg, candidates } = character;
  const characterName = character.name || '인물이름';
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState(null);
  const busyRef = useRef(false);

  const loadCandidates = useCallback(async () => {
    const result = await getCandidates(charId);
    if (result.success) {
      setCharacterInfo((prev) => [{ ...prev[0], candidates: result.candidates }, ...prev.slice(1)]);
    } else {
      setFailure({ error: result.error, retry: loadCandidates });
    }
  }, [charId, setCharacterInfo]);

  useEffect(() => {
    if (!candidates && charId) loadCandidates();
  }, [candidates, charId, loadCandidates]);

  useEffect(() => {
    if (!candidates || candidates.length === 0) return;
    if (candidates.some((c) => c.candidateId === selectedId)) return;
    const approved = candidates.find((c) => c.approved);
    setSelectedId((approved || candidates[candidates.length - 1]).candidateId);
  }, [candidates, selectedId]);

  useEffect(() => {
    if (!busy) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // 다시 시도할 수 없는 오류(declined 등)는 카드의 버튼 말고도 Escape나 탭으로 닫고 "다른 인물로 바꿀래요."를 누를 수 있다.
  useEffect(() => {
    if (!failure || failure.error.retryable) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFailure(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [failure]);

  const perform = async (kind, call) => {
    busyRef.current = true;
    setBusy(kind);
    setFailure(null);
    const result = await call();
    busyRef.current = false;
    setBusy(null);
    return result;
  };

  const handleRegenerate = async () => {
    if (busyRef.current || !candidates || candidates.length >= MAX_CANDIDATES) return;
    const result = await perform('regenerate', () => regenerateCandidate(charId));
    if (result.success) {
      setCharacterInfo((prev) => [
        { ...prev[0], candidates: [...(prev[0].candidates || []), result.candidate] },
        ...prev.slice(1),
      ]);
      setSelectedId(result.candidate.candidateId);
    } else {
      setFailure({ error: result.error, retry: handleRegenerate });
    }
  };

  const handleApprove = async () => {
    if (busyRef.current || !selectedId) return;
    const result = await perform('approve', () => approveCandidate(charId, selectedId));
    if (result.success) {
      setCharacterInfo((prev) => [
        {
          ...prev[0],
          img: result.charImg,
          candidates: (prev[0].candidates || []).map((c) => ({ ...c, approved: c.candidateId === selectedId })),
        },
        ...prev.slice(1),
      ]);
      navigate('/story-question');
    } else {
      setFailure({ error: result.error, retry: handleApprove });
    }
  };

  const handleRetry = () => {
    const { retry } = failure;
    setFailure(null);
    retry();
  };

  const dismissIfNotRetryable = () => {
    if (failure && !failure.error.retryable) setFailure(null);
  };

  // 새로고침으로 고른 캐릭터가 사라졌으면 남의 후보를 보이지 않고 캐릭터 선택으로 보낸다
  if (!charId) return <Navigate to="/character-select" replace state={{ flowLost: true }} />;

  const count = candidates ? candidates.length : 0;
  const selected = (candidates || []).find((c) => c.candidateId === selectedId) || null;

  return (
    <BaseScreenLayout
      progressText="3/3"
      progressCurrent={3}
      progressTotal={3}
      title={`${characterName}!\n이렇게 생겼군요!`}
      subTitle="사진과 닮았는지 보고 골라 주세요."
    >
      <Compare>
        {userImg && (
          <Frame>
            <Art src={userImg} alt={`${characterName}의 원본 사진`} />
            <Caption>원본 사진</Caption>
          </Frame>
        )}
        {selected && (
          <Frame $mirror>
            <Art src={selected.imgUrl} alt={`${characterName}의 동화 속 모습`} />
            <Caption>동화 속 모습</Caption>
          </Frame>
        )}
      </Compare>

      {count > 0 && (
        <>
          <SectionLabel>후보 중에서 고르기</SectionLabel>
          <Thumbs>
            {candidates.slice(0, MAX_CANDIDATES).map((c, i) => (
              <Thumb
                key={c.candidateId}
                type="button"
                aria-pressed={c.candidateId === selectedId}
                onClick={() => setSelectedId(c.candidateId)}
              >
                {c.candidateId === selectedId && (
                  <Check>
                    <CheckIcon />
                  </Check>
                )}
                <ThumbArt src={c.imgUrl} alt="" />
                <ThumbLabel>{ORDINALS[i]}</ThumbLabel>
              </Thumb>
            ))}
          </Thumbs>
        </>
      )}

      <Actions>
        <RoundedButton $primary type="button" onClick={handleApprove} disabled={!selected || Boolean(busy)}>
          이 캐릭터로 할래요
        </RoundedButton>
        <RoundedButton
          type="button"
          onClick={handleRegenerate}
          disabled={count >= MAX_CANDIDATES || Boolean(busy)}
        >
          다시 만들기 ({count}/{MAX_CANDIDATES})
        </RoundedButton>
        <RoundedButton $quiet type="button" onClick={() => navigate('/character-select')}>
          다른 인물로 바꿀래요.
        </RoundedButton>
      </Actions>

      {busy && <WaitingOverlay message={WAITING[busy]} elapsed={elapsed || undefined} />}

      {failure && (
        <div onClick={dismissIfNotRetryable}>
          <GenerationError error={failure.error} onRetry={handleRetry} onClose={dismissIfNotRetryable} />
        </div>
      )}
    </BaseScreenLayout>
  );
}
