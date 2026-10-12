import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { characterInfoState } from '../recoil/atoms';
import BaseScreenLayout, { PaperFrame } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import TextButton from '../components/TextButton';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import Skeleton from '../components/Skeleton';
import { PickCheck, pickedRing } from '../components/Pick';
import { getCandidates, regenerateCandidate, approveCandidate } from '../api/character';

const MAX_CANDIDATES = 3;
const ORDINALS = ['첫 번째', '두 번째', '세 번째'];
const WAITING = {
  regenerate: '도깨비가 주인공을 다시 그리고 있어요',
  approve: '도깨비가 주인공을 기억하고 있어요',
};

// 원본 사진과 동화 속 모습을 휴대폰에서도 두 칸으로 나란히 둔다(닮았는지 한눈에 비교)
const Compare = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.space[4]};
  align-items: start;

  @media ${({ theme }) => theme.mq.phone} {
    gap: ${({ theme }) => theme.space[3]};
  }
`;

// 옅은 회색 판(surface2) 위의 그림. 두 칸 격자 안이라 폭 제한과 위 여백은 격자에 맡긴다
const Frame = styled(PaperFrame)`
  max-width: none;
  margin: 0;

  @media ${({ theme }) => theme.mq.phone} {
    padding: ${({ theme }) => theme.space[2]};
  }
`;

// 사진은 얼굴 쪽(위 30%)을, 동화 그림은 머리부터 보이게 3:4로 채운다
const Art = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: ${({ $photo }) => ($photo ? 'center 30%' : 'center top')};
  border-radius: ${({ theme }) => theme.radius.inner};
  background: ${({ theme }) => theme.colors.surface2};
`;

// 후보를 불러오는 동안 그림 자리(공통 Skeleton, 다른 화면의 빈 자리와 같은 깜빡임)
const ArtSkeleton = styled(Skeleton)`
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: ${({ theme }) => theme.radius.inner};
`;

// 그림 이름: 회색 판 위라 inkSoft(6.5:1) medium
const Caption = styled.figcaption`
  margin-top: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: ${({ theme }) => theme.weight.medium};
  line-height: ${({ theme }) => theme.leading.tight};
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
`;

// 묶음 라벨: 입력칸 라벨과 같은 15px semibold ink
const SectionLabel = styled.p`
  margin-bottom: ${({ theme }) => theme.space[3]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  color: ${({ theme }) => theme.colors.ink};
`;

// 후보 썸네일: 세 칸까지 한 줄, 칸은 7.5rem을 넘지 않는다
const Thumbs = styled.div`
  display: grid;
  grid-template-columns: repeat(${MAX_CANDIDATES}, minmax(0, 7.5rem));
  gap: ${({ theme }) => theme.space[3]};
`;

// 고르는 썸네일: 흰 바탕 + 가는 테두리(카드와 같은 line). 올리면 surface2 바탕에 테두리가 조금 진해진다.
// 고르면 공통 선택 표시(옅은 파랑 바탕 + 파란 고리 + 체크 원), 글자는 accentDeep(7.1:1)
const Thumb = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  min-width: 0;
  min-height: ${({ theme }) => theme.tap};
  padding: ${({ theme }) => theme.space[1]};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.inkSoft};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  text-align: center;
  cursor: pointer;

  @media ${({ theme }) => theme.mq.hover} {
    &:hover {
      background: ${({ theme }) => theme.colors.surface2};
      border-color: ${({ theme }) => theme.colors.lineStrong};
      color: ${({ theme }) => theme.colors.ink};
    }
  }

  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.colors.accentPale};
    border-color: transparent;
    box-shadow: ${({ theme }) => pickedRing(theme)};
    color: ${({ theme }) => theme.colors.accentDeep};
  }

  /* 포커스 고리는 고른 고리 바깥에 떨어뜨려 그린다 */
  &:focus-visible {
    outline-offset: 0.375rem;
  }
`;

const ThumbArt = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top;
  border-radius: ${({ theme }) => theme.radius.inner};
  background: ${({ theme }) => theme.colors.surface2};
`;

const ThumbLabel = styled.span`
  display: block;
  padding-bottom: ${({ theme }) => theme.space[1]};
`;


// 버튼 줄: 주요 → 보조를 세로로 쌓고, 가장 약한 길(다른 인물)은 글자 버튼으로 아래 가운데에 둔다
const Actions = styled.div`
  margin-top: ${({ theme }) => theme.space[6]};

  @media ${({ theme }) => theme.mq.phone} {
    margin-top: ${({ theme }) => theme.space[5]};
  }
`;

const AltRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${({ theme }) => theme.space[2]};
`;

export default function ConfirmCharacterScreen() {
  const navigate = useNavigate();
  const [characterInfo, setCharacterInfo] = useRecoilState(characterInfoState);
  const character = characterInfo[0] || {};
  const { charId, userImg, candidates } = character;
  // 이름이 없으면 '주인공'으로 부른다
  const heroName = character.name || '주인공';
  const title = character.name ? `${character.name}!\n이렇게 생겼군요!` : '주인공이\n이렇게 생겼군요!';
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

  // 다시 시도할 수 없는 오류(declined 등)는 카드의 버튼 말고도 Escape나 탭으로 닫고 "다른 인물로 바꿀래요"를 누를 수 있다.
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
  // 후보를 아직 받지 못했다(받는 중이거나 받기에 실패해 다시 시도를 기다린다)
  const loadingCandidates = !candidates;
  const selected = (candidates || []).find((c) => c.candidateId === selectedId) || null;

  return (
    <BaseScreenLayout
      progressCurrent={3}
      progressTotal={3}
      title={title}
      subTitle="사진과 닮았는지 보고 골라 주세요."
      aside={
        <Compare>
          {userImg && (
            <Frame>
              <Art $photo src={userImg} alt={`${heroName}의 원본 사진`} />
              <Caption>원본 사진</Caption>
            </Frame>
          )}
          {selected ? (
            <Frame>
              <Art src={selected.imgUrl} alt={`${heroName}의 동화 속 모습`} />
              <Caption>동화 속 모습</Caption>
            </Frame>
          ) : (
            loadingCandidates && (
              <Frame aria-busy="true">
                <ArtSkeleton aria-hidden="true" />
                <Caption>동화 속 모습</Caption>
              </Frame>
            )
          )}
        </Compare>
      }
    >
      {/* 후보가 하나면 위의 큰 그림과 같으니 썸네일 줄을 두지 않는다 */}
      {count > 1 && (
        <>
          <SectionLabel id="candidate-label">후보 중에서 고르기</SectionLabel>
          <Thumbs role="group" aria-labelledby="candidate-label">
            {candidates.slice(0, MAX_CANDIDATES).map((c, i) => (
              <Thumb
                key={c.candidateId}
                type="button"
                aria-pressed={c.candidateId === selectedId}
                onClick={() => setSelectedId(c.candidateId)}
              >
                {c.candidateId === selectedId && <PickCheck />}
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
          disabled={loadingCandidates || count >= MAX_CANDIDATES || Boolean(busy)}
        >
          다시 만들기 ({count}/{MAX_CANDIDATES})
        </RoundedButton>
        <AltRow>
          <TextButton $soft onClick={() => navigate('/character-select')}>
            다른 인물로 바꿀래요
          </TextButton>
        </AltRow>
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
