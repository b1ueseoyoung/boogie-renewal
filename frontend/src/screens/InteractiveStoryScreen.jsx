import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import styled from 'styled-components';
import { storyCreationState, isStoryGeneratedState } from '../recoil/atoms';
import BaseScreenLayout, { rise } from '../components/BaseScreenLayout';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import { postStoryNext } from '../api/story';
import { speak, stopSpeaking } from '../utils/speak';

const TOTAL_STEPS = 5;

// 장면이 바뀌면(key=step) 그림과 글이 다시 떠오른다. 카드 없이 바탕 위에 펼친 그림책처럼 둔다
const Scene = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[5]};
  align-items: center;
  grid-template-columns: minmax(0, 1fr);
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  @media (min-width: 52.0625rem) {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
`;

const Art = styled.img`
  display: block;
  width: 100%;
  /* 선택지까지 한 화면에 들어오도록 화면 높이에 맞춘다 */
  max-width: min(34rem, 52vh);
  margin: 0 auto;
  aspect-ratio: 1 / 1;

  @media (max-width: 52rem) {
    max-width: min(100%, 34vh);
  }
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface2};
  box-shadow: ${({ theme }) => theme.shadow.art};
`;

const Words = styled.div`
  min-width: 0;
`;

const StoryText = styled.p`
  font-size: ${({ theme }) => theme.text.story};
  line-height: 1.85;
`;

// 도깨비의 말풍선: 꼬리가 왼쪽 위를 가리킨다
const Question = styled.h1`
  position: relative;
  margin-top: ${({ theme }) => theme.space[5]};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[5]}`};
  font-size: ${({ theme }) => theme.text.xl};
  line-height: 1.4;
  background: ${({ theme }) => theme.colors.sunPale};
  border-radius: ${({ theme }) => theme.radius.card};

  &::before {
    content: '';
    position: absolute;
    top: -0.625rem;
    left: 2rem;
    border: 0.625rem solid transparent;
    border-top: 0;
    border-bottom-color: ${({ theme }) => theme.colors.sunPale};
  }
`;

const Choices = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[4]};
  grid-template-columns: repeat(auto-fit, minmax(min(14rem, 100%), 1fr));
  margin-top: ${({ theme }) => theme.space[5]};
`;

const Choice = styled.button`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};
  align-items: center;
  min-height: 3.5rem;
  margin-bottom: 0.25rem; /* 바닥 턱 자리 */
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[5]} ${theme.space[3]} ${theme.space[3]}`};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  line-height: 1.35;
  text-align: left;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.card};
  box-shadow: ${({ theme }) => theme.shadow.ledgeSoft};
  cursor: pointer;
  /* 선택지가 하나씩 차례로 나타난다 */
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`} backwards;
  animation-delay: ${({ $order }) => `${120 + $order * 70}ms`};

  &:hover {
    background: ${({ theme }) => theme.colors.accentPale};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:active {
    box-shadow: none;
  }
`;

const ChoiceNum = styled.span`
  display: grid;
  place-items: center;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.sun};
  border-radius: 50%;
`;

export default function InteractiveStoryScreen() {
  const navigate = useNavigate();
  const [storyData, setStoryData] = useRecoilState(storyCreationState);
  const { choices = [], step, question, story, image } = storyData;
  const setIsStoryGenerated = useSetRecoilState(isStoryGeneratedState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [lastChoice, setLastChoice] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!question && !story) return undefined;
    let isCancelled = false;

    const splitText = (text) =>
      text ? text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) || [text] : [];

    (async () => {
      for (const chunk of [...splitText(story), ...splitText(question)]) {
        if (isCancelled || !(await speak(chunk))) break;
      }
    })();

    return () => {
      isCancelled = true;
      stopSpeaking();
    };
  }, [question, story]);

  useEffect(() => {
    if (!pending) return undefined;
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  // 다시 시도할 수 없는 오류(limit 등)는 카드의 버튼 말고도 Escape나 탭으로 닫는다.
  useEffect(() => {
    if (!error || error.retryable) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setError(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [error]);

  const handleOptionClick = async (choice) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    stopSpeaking();
    setLastChoice(choice);
    setError(null);
    setPending(true);

    const result = await postStoryNext({ choice });
    pendingRef.current = false;
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    const { data } = result;
    if (result.status === 201) {
      setIsStoryGenerated(true);
      navigate('/reading?file=' + encodeURIComponent(data.contentUrl) + '&title=' + encodeURIComponent(data.title));
      return;
    }
    setStoryData((prev) => ({
      ...prev,
      history: [...prev.history, data.story],
      story: data.story,
      question: data.question,
      image: data.s3_url,
      choices: data.choices,
      step: prev.step + 1,
    }));
  };

  const handleRetry = () => handleOptionClick(lastChoice);

  const dismissIfNotRetryable = () => {
    if (error && !error.retryable) setError(null);
  };

  // 새로고침으로 이야기 상태가 사라졌다. 진행 중 이야기를 읽어 올 API가 없어 이어 갈 수 없으니 처음으로 보낸다.
  if (!(step >= 1)) return <Navigate to="/character-select" replace state={{ flowLost: true }} />;

  return (
    <BaseScreenLayout bare progressText={`${step}장 / ${TOTAL_STEPS}장`} progressCurrent={step} progressTotal={TOTAL_STEPS}>
      <Scene key={`scene-${step}`}>
        <Art src={image} alt="장면 삽화" />
        <Words>
          <StoryText>{story}</StoryText>
          <Question>{question}</Question>
        </Words>
      </Scene>

      <Choices key={`choices-${step}`}>
        {(choices.length > 0 ? choices : ['다음']).map((opt, idx) => (
          <Choice key={idx} type="button" $order={idx} onClick={() => handleOptionClick(opt)}>
            <ChoiceNum aria-hidden="true">{idx + 1}</ChoiceNum>
            {opt}
          </Choice>
        ))}
      </Choices>

      {pending && <WaitingOverlay message="도깨비가 다음 장면을 그리고 있어요" elapsed={elapsed} />}

      {error && (
        <div onClick={dismissIfNotRetryable}>
          <GenerationError error={error} onRetry={handleRetry} onClose={dismissIfNotRetryable} scene />
        </div>
      )}
    </BaseScreenLayout>
  );
}
