import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import styled from 'styled-components';
import { storyCreationState, characterInfoState, coverImageState } from '../recoil/atoms';
import BaseScreenLayout from '../components/BaseScreenLayout';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import { speak, stopSpeaking } from '../utils/speak';

const FALLBACK_ERROR = { errorClass: 'error', retryable: true };

const Highlight = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

const displayToBackendMap = {
  // 장르 (genre)
  '일상': 'life',
  '마법': 'magic',
  '영웅': 'hero',
  '액션': 'action',
  '모험': 'adventure',

  // 장소 (place)
  '우주': 'space',
  '왕국': 'kingdom',
  '산': 'mountain',
  '바다': 'sea',
  '학교': 'school',
  '집': 'home',
};

const backendToDisplayMap = Object.fromEntries(Object.entries(displayToBackendMap).map(([k, v]) => [v, k]));

const storyQuestions = [
  { key: 'genre', question: '장르를 선택해 주세요.', options: ['일상', '마법', '영웅', '액션', '모험'] },
  { key: 'place', question: '장소를 선택해 주세요.', options: ['우주', '왕국', '산', '바다', '학교', '집'] },
];

const Options = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
  grid-template-columns: repeat(auto-fit, minmax(min(9rem, 100%), 1fr));
  margin-top: ${({ theme }) => theme.space[3]};

  @media (max-width: 30rem) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Option = styled.button`
  min-height: ${({ theme }) => theme.tap};
  padding: ${({ theme }) => `${theme.space[4]} ${theme.space[4]}`};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.card};
  cursor: pointer;
  transition: background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  &:hover {
    background: ${({ theme }) => theme.colors.accentPale};
  }
`;

export default function StoryQuestionScreen() {
  const navigate = useNavigate();
  const [storyData, setStoryData] = useRecoilState(storyCreationState);
  const [characterInfo] = useRecoilState(characterInfoState);
  const setCoverImage = useSetRecoilState(coverImageState);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [failure, setFailure] = useState(null);
  const loadingRef = useRef(false);

  const current = storyQuestions[questionIndex];

  useEffect(() => {
    speak(current.question);
    return stopSpeaking;
  }, [current.question]);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (!failure || failure.error.retryable) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setFailure(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [failure]);

  const requestIntro = async (payload) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    stopSpeaking();
    setFailure(null);
    setLoading(true);

    let res = null;
    let body = null;
    try {
      res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/intro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      body = await res.json().catch(() => null);
    } catch (networkError) {
      res = null;
    }
    loadingRef.current = false;
    setLoading(false);

    if (res && res.ok && body) {
      setStoryData((prev) => ({
        ...prev,
        step: 1,
        history: [body.story],
        story: body.story,
        image: body.imgUrl,
        choices: body.choices,
        question: body.question,
      }));
      setCoverImage(body.imgUrl);
      navigate('/confirm-story');
      return;
    }

    const error = body && body.errorClass ? body : FALLBACK_ERROR;
    if (error.errorClass === 'character_not_approved') {
      navigate('/confirm-character');
      return;
    }
    setFailure({ error, payload });
  };

  const handleSelect = (option) => {
    if (loadingRef.current) return;
    const key = current.key;
    const charID = parseInt(characterInfo[0].charId, 10);
    const backendOption = displayToBackendMap[option];
    setStoryData((prev) => ({
      ...prev,
      charId: charID,
      ...(key === 'genre' && { genre: backendOption }),
      ...(key === 'place' && { place: backendOption }),
    }));

    if (questionIndex < storyQuestions.length - 1) {
      setQuestionIndex((i) => i + 1);
      return;
    }
    requestIntro({
      charId: charID,
      genre: key === 'genre' ? backendOption : storyData.genre,
      place: key === 'place' ? backendOption : storyData.place,
    });
  };

  const dismissIfNotRetryable = () => {
    if (failure && !failure.error.retryable) setFailure(null);
  };

  // 새로고침으로 고른 캐릭터가 사라졌으면 남의 캐릭터로 요청하지 않고 캐릭터 선택으로 보낸다
  if (!characterInfo[0]?.charId) return <Navigate to="/character-select" replace state={{ flowLost: true }} />;

  return (
    <BaseScreenLayout
      progressText={`${questionIndex + 1} / ${storyQuestions.length}`}
      progressCurrent={questionIndex + 1}
      progressTotal={storyQuestions.length}
      title={
        questionIndex === 1 ? (
          <>
            <Highlight>{backendToDisplayMap[storyData.genre]}</Highlight>을 선택했군요!
            <br />
            {current.question}
          </>
        ) : (
          current.question
        )
      }
      subTitle="이야기에 대해 말해 주세요."
    >
      <Options>
        {current.options.map((opt) => (
          <Option key={opt} type="button" onClick={() => handleSelect(opt)}>
            {opt}
          </Option>
        ))}
      </Options>

      {loading && <WaitingOverlay message="도깨비가 첫 장면을 그리고 있어요" elapsed={elapsed} />}

      {failure && (
        <div onClick={dismissIfNotRetryable}>
          <GenerationError error={failure.error} onRetry={() => requestIntro(failure.payload)} onClose={dismissIfNotRetryable} scene />
        </div>
      )}
    </BaseScreenLayout>
  );
}
