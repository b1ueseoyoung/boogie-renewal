import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import styled from 'styled-components';
import { storyCreationState, isStoryGeneratedState } from '../recoil/atoms';
import BaseScreenLayout, { rise, SunDisc } from '../components/BaseScreenLayout';
import ChoiceButton from '../components/ChoiceButton';
import RoundedButton from '../components/RoundedButton';
import WaitingOverlay from '../components/WaitingOverlay';
import GenerationError from '../components/GenerationError';
import { postStoryNext } from '../api/story';
import { speak, stopSpeaking } from '../utils/speak';
import dokkaebiAsk from '../assets/images/dokkaebi_where.png';

const TOTAL_STEPS = 5;

// 장면 삽화의 가로:세로(생성 그림 1106×1422)
const ART_RATIO = '7 / 9';

// 펼친 그림책 한 권: 넓으면 그림 쪽(왼쪽) | 글 쪽(오른쪽), 좁으면 그림 → 글로 쌓은 한 쪽.
// 장면이 바뀌면(key=step) 책이 다시 떠오른다. 움직임을 줄이는 설정이면 전역 규칙이 움직임을 끈다.
// 흰 카드처럼 그림자 없이 바깥 1px line으로 바탕과 나눈다(테두리 대신 선을 그려 크기는 그대로다)
const Book = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  @media ${({ theme }) => theme.mq.wide} {
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
  }
`;

// 그림 쪽: 옅은 회색 면(surface2) 위에 삽화를 둔다
const ArtPage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.colors.surface2};

  @media ${({ theme }) => theme.mq.wide} {
    padding: ${({ theme }) => theme.space[6]};
  }
`;

// 비율을 지킨 채 화면 높이에 맞춘다. 좁은 화면은 첫 화면에 글이 조금 보이도록 더 작게 둔다
const Art = styled.img`
  display: block;
  width: min(100%, calc(var(--vh, 1vh) * 38 * 7 / 9));
  height: auto;
  aspect-ratio: ${ART_RATIO};
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface};

  @media ${({ theme }) => theme.mq.wide} {
    width: min(100%, calc((var(--vh, 1vh) * 100 - 14rem) * 7 / 9));
  }
`;

// 글 쪽: 이야기 글 → 도깨비의 질문 → 선택지. 넓으면 가운데 접힌 곳(왼쪽 가장자리)에 옅은 그늘
const WordsPage = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${({ theme }) => theme.space[5]};
  min-width: 0;
  padding: ${({ theme }) => `${theme.space[5]} ${theme.space[5]} ${theme.space[6]}`};

  @media ${({ theme }) => theme.mq.wide} {
    padding: ${({ theme }) => theme.space[7]};
    box-shadow: ${({ theme }) => theme.shadow.gutter};
  }
`;

const StoryText = styled.p`
  max-width: 34em;
  font-size: ${({ theme }) => theme.text.story};
  line-height: ${({ theme }) => theme.leading.body};
`;

// 도깨비가 묻는다: 회색 원 안의 도깨비 + 옅은 파랑 말풍선(꼬리가 도깨비를 가리킨다)
const Ask = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
`;

// 원은 surface2: 옆 말풍선(accentPale)과 같은 색이면 꼬리 끝에서 두 면이 붙어 보인다
const Asker = styled(SunDisc)`
  margin-top: ${({ theme }) => theme.space[1]};
  background: ${({ theme }) => theme.colors.surface2};
`;

// 질문 말풍선: accentPale 바탕 + ink bold(14.5:1)
const Question = styled.h1`
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[5]}`};
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: ${({ theme }) => theme.weight.bold};
  line-height: 1.4;
  letter-spacing: ${({ theme }) => theme.tracking.tight};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.accentPale};
  border-radius: ${({ theme }) => theme.radius.card};
  overflow-wrap: anywhere;
  text-wrap: pretty;

  &::before {
    content: '';
    position: absolute;
    top: 1.125rem;
    left: -0.5rem;
    border: 0.5rem solid transparent;
    border-left: 0;
    border-right-color: ${({ theme }) => theme.colors.accentPale};
  }
`;

const Choices = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
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
    <BaseScreenLayout
      bare
      progressCurrent={step}
      progressTotal={TOTAL_STEPS}
      progressUnit="장"
    >
      <Book key={`scene-${step}`}>
        <ArtPage>
          <Art src={image} alt="장면 삽화" />
        </ArtPage>
        <WordsPage>
          <StoryText>{story}</StoryText>
          {question && (
            <Ask>
              <Asker $size="3.5rem" $fill="86%" aria-hidden="true">
                <img src={dokkaebiAsk} alt="" />
              </Asker>
              <Question>{question}</Question>
            </Ask>
          )}
          {/* 고를 것이 없는 장면은 번호 없는 '다음' 버튼 하나만 둔다 */}
          {choices.length > 0 ? (
            <Choices>
              {choices.map((opt, idx) => (
                <ChoiceButton key={idx} index={idx} text={opt} onClick={() => handleOptionClick(opt)} />
              ))}
            </Choices>
          ) : (
            <RoundedButton type="button" $primary onClick={() => handleOptionClick('다음')}>
              다음
            </RoundedButton>
          )}
        </WordsPage>
      </Book>

      {pending && <WaitingOverlay message="도깨비가 다음 장면을 그리고 있어요" elapsed={elapsed} />}

      {error && (
        <div onClick={dismissIfNotRetryable}>
          <GenerationError error={error} onRetry={handleRetry} onClose={dismissIfNotRetryable} scene />
        </div>
      )}
    </BaseScreenLayout>
  );
}
