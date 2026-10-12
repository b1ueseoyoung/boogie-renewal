import React, { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { characterInfoState } from '../recoil/atoms';
import BaseScreenLayout, { PaperFrame } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import FormField, { FormStack } from '../components/FormField';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import { postCharacter } from '../api/character';
import { speak, stopSpeaking } from '../utils/speak';
import silhouetteImg from '../assets/images/silhouette.png';

// 앞 단계에서 올린 사진. 좁은 화면에서는 정사각형으로 잘라 입력 칸이 첫 화면 안에 들어오게 한다
const Photo = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  object-position: center 30%;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface2};

  @media ${({ theme }) => theme.mq.wide} {
    aspect-ratio: 3 / 4;
  }
`;

const questionText = '주인공의 이름이 무엇인가요?';

export default function CharacterQuestionScreen() {
  const navigate = useNavigate();
  const [characterInfo, setCharacterInfo] = useRecoilState(characterInfoState);
  const [name, setName] = useState(characterInfo[0]?.name || '');
  const userImg = characterInfo[0]?.userImg;
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const busyRef = useRef(false);

  useEffect(() => {
    speak(questionText);
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    if (!busy) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  // 다시 시도할 수 없는 오류(duplicate_name 등)는 카드의 버튼 말고도 Escape나 탭으로 닫고 이름을 고칠 수 있다.
  useEffect(() => {
    if (!error || error.retryable) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setError(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [error]);

  const handleNext = async () => {
    const charName = name.trim();
    if (!charName || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);

    const result = await postCharacter({ charName, userImg: characterInfo[0]?.userImg });

    busyRef.current = false;
    setBusy(false);
    if (result.success) {
      setCharacterInfo((prev) => [
        { ...prev[0], name: charName, img: result.charImg, charId: result.charId, candidates: result.candidates },
        ...prev.slice(1),
      ]);
      navigate('/confirm-character');
    } else {
      setError(result.error);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleNext();
  };

  const handleRetry = () => {
    setError(null);
    handleNext();
  };

  const dismissIfNotRetryable = () => {
    if (error && !error.retryable) setError(null);
  };

  return (
    <BaseScreenLayout
      progressCurrent={2}
      progressTotal={3}
      title={`주인공의 이름이\n무엇인가요?`}
      subTitle="이름을 입력하고 다음으로 넘어가세요."
      aside={
        userImg ? (
          <PaperFrame>
            <Photo src={userImg} alt="올린 주인공 사진" />
          </PaperFrame>
        ) : undefined
      }
      imageSrc={silhouetteImg}
      imageAlt="주인공 실루엣"
      imageFill="pencil"
    >
      <FormStack onSubmit={handleSubmit}>
        <FormField
          id="character-name"
          label="주인공 이름"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름 입력"
          aria-label="주인공 이름"
          autoComplete="off"
        />
        {/* 이름이 비면 눌러도 넘어가지 않으므로 비활성으로 보인다 */}
        <RoundedButton $primary type="submit" disabled={busy || !name.trim()}>
          확인
        </RoundedButton>
      </FormStack>

      {busy && <WaitingOverlay message="도깨비가 주인공을 그리고 있어요" elapsed={elapsed || undefined} />}

      {error && (
        <div onClick={dismissIfNotRetryable}>
          <GenerationError error={error} onRetry={handleRetry} onClose={dismissIfNotRetryable} />
        </div>
      )}
    </BaseScreenLayout>
  );
}
