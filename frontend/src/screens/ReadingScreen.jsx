import React, { useState, useRef, useEffect, useMemo } from 'react';
import { speak, stopSpeaking } from '../utils/speak';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import HTMLFlipBook from 'react-pageflip';
import BaseScreenLayout, { PaperFrame, StepDots } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import finishImg from '../assets/images/finish.png';

const BOOK_BORDER = 6;
const PAGE_RATIO = 4 / 3;
const NARROW_PAGE = 240;

const Stage = styled.div`
  width: 100%;
  min-width: 0;
`;

// 펼친 그림책: 테두리 없이 그림자로 바탕에서 띄운다
const Book = styled.div`
  width: fit-content;
  max-width: 100%;
  margin: ${({ theme }) => theme.space[2]} auto 0;
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.art};
  overflow: hidden;
`;

// react-pageflip이 쪽 요소에 inline display:block을 덮어써서 아래 flex 정렬이 사라지므로 가운데 정렬은 안쪽 PageBody가 맡는다.
// display:flex는 pageflip이 쪽을 띄우기 전(라이브러리의 .stf__item display:none보다 앞서) 쪽이 보이던 원래 동작을 지키려고 둔다.
const Page = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: ${({ theme, $narrow }) => ($narrow ? theme.space[2] : theme.space[5])};
  background: ${({ theme, $art }) => ($art ? theme.colors.surface2 : theme.colors.surface)};
  /* 글 쪽의 왼쪽(가운데 접힌 곳)에 옅은 그늘 */
  box-shadow: ${({ $art }) => ($art ? 'none' : 'inset 1.75rem 0 1.75rem -1.75rem rgba(91, 64, 34, 0.28)')};
`;

const PageBody = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ArtFrame = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ArtImg = styled.img`
  display: block;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface};
`;

const StoryText = styled.p`
  max-width: 24ch;
  max-height: 100%;
  overflow-y: auto;
  font-size: ${({ theme, $narrow }) => ($narrow ? theme.text.sm : theme.text.story)};
  line-height: ${({ theme, $narrow }) => ($narrow ? 1.6 : theme.leading.body)};
  text-align: center;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.ink};
`;

const Reader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[5]};
`;

const ProgressInfo = styled.p`
  flex: 0 0 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const NavButton = styled(RoundedButton)`
  width: auto;
  margin: 0;

  & + & {
    margin-top: 0;
  }

  @media (max-width: 30rem) {
    padding-inline: ${({ theme }) => theme.space[3]};
    font-size: ${({ theme }) => theme.text.base};
  }
`;

const RoundButton = styled(NavButton)`
  width: 3.25rem;
  height: 3.25rem;
  min-height: 3.25rem;
  padding: 0;
  border-radius: 50%;
  flex: none;

  @media (max-width: 30rem) {
    padding-inline: 0;
  }
`;

const StatusText = styled.p`
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.space[4]};
  background: ${({ theme }) => theme.colors.scrim};
  z-index: 100;
`;

const Dialog = styled.div`
  width: min(100%, 24rem);
  padding: ${({ theme }) => `${theme.space[6]} ${theme.space[5]} ${theme.space[5]}`};
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.card};
  box-shadow: ${({ theme }) => theme.shadow.card};
  text-align: center;
`;

const FinishImg = styled.img`
  display: block;
  width: 100%;
`;

const DialogTitle = styled.h2`
  margin-top: ${({ theme }) => theme.space[5]};
  font-size: ${({ theme }) => theme.text.xl};
`;

const DialogText = styled.p`
  margin-bottom: ${({ theme }) => theme.space[4]};
  overflow-wrap: anywhere;
`;

const SpeakerIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 5a9 9 0 0 1 0 14" />
  </svg>
);

const PauseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M9 5v14" />
    <path d="M15 5v14" />
  </svg>
);

export default function ReadingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileUrl = new URLSearchParams(location.search).get('file')?.replace(/^"|"$/g, '');
  const titleFromQuery = new URLSearchParams(location.search).get('title') || '';

  const [title, setTitle] = useState(titleFromQuery || '제목 없음');
  const [texts, setTexts] = useState([]);
  const [images, setImages] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showFinishPopup, setShowFinishPopup] = useState(false);
  const [pageSize, setPageSize] = useState(null);

  const speakSeq = useRef(0); // 가장 최근 speakText 호출 번호
  const bookRef = useRef(null);
  const stageRef = useRef(null);
  const mountedRef = useRef(true); // 화면이 떠 있는 동안 true, 떠나면 false

  const spread = Math.floor(currentPage / 2) + 1;

  const autoPlay = true;

  useEffect(() => {
    if (!fileUrl) {
      setLoadError(true);
      return;
    }
    setLoadError(false);
    const fetchData = async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const content = Array.isArray(data) ? data : data.content || [];
        if (!content.length) throw new Error('빈 동화');

        setTitle(data.title || titleFromQuery || '제목 없음');
        setTexts(content.map(item => item.story));
        setImages(content.map(item => item.illustUrl));
      } catch (e) {
        console.error('fetch 실패:', e);
        setLoadError(true);
      }
    };

    fetchData();
  }, [fileUrl]);

  useEffect(() => {
    if (texts.length && images.length && currentPage === 0) {
      if (autoPlay && texts[0]) speakText(texts[0], 0);
    }
  }, [texts, images]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false; // 떠난 뒤 끝나는 넘김 애니메이션이 읽기를 시작하지 못하게 한다
      stopSpeaking(); // 화면을 떠나면 읽기를 멈춘다
    };
  }, []);

  // 펼친 두 면이 카드 안에 들어가도록 쪽 크기를 다시 계산한다. 크기가 바뀌면 key로 책을 다시 만들고 startPage로 보던 쪽을 잇는다.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const updateSize = () => {
      const maxHeight = Math.max(260, window.innerHeight - 380); // 제목, 진행 점, 버튼 줄이 한 화면에 함께 들어오게
      const byWidth = (stage.clientWidth - BOOK_BORDER) / 2;
      const width = Math.floor(Math.min(byWidth, maxHeight / PAGE_RATIO));
      const height = Math.floor(width * PAGE_RATIO);
      setPageSize(prev => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [texts.length, images.length]); // setTexts와 setImages가 따로 렌더되므로(ReactDOM.render) 둘 다 본다

  const stopAudio = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

// 문장 단위 분할
const splitText = (text) =>
  text ? text.match(/[^\.!\?]+[\.!\?]+/g)?.map(s => s.trim()) || [text] : [];

// 문장별로 순차 재생. 끝까지 읽었으면 true, 멈췄거나 못 읽었으면 false
const playChunks = async (chunks) => {
  for (const chunk of chunks) {
    if (!(await speak(chunk))) return false;
  }
  return true;
};

const speakText = async (text, pageIndex) => {
  if (!mountedRef.current) return; // 화면을 떠난 뒤에는 읽지 않는다
  stopAudio();
  if (!text) return;

  try {
    const chunks = splitText(text);
    const seq = ++speakSeq.current;
    setIsSpeaking(true);
    const finished = await playChunks(chunks);
    if (seq !== speakSeq.current) return; // 그사이 새 읽기가 시작됐다
    setIsSpeaking(false);
    if (!finished) return; // 끝까지 읽었을 때만 자동으로 넘긴다

    const isLast = pageIndex >= texts.length - 1;
    if (autoPlay && !isLast) {
      const flipAPI = bookRef.current?.pageFlip?.();
      flipAPI?.flip?.((pageIndex + 1) * 2);
    } else if (autoPlay && isLast) {
      setShowFinishPopup(true);
    }
  } catch (err) {
    console.error('[speakText 오류]', err);
    setIsSpeaking(false);
  }
};

const handleFlip = (e) => {
  if (!mountedRef.current) return; // 떠난 뒤 끝난 넘김 애니메이션은 무시한다
  const newPage = e.data;
  setCurrentPage(newPage);

  // 텍스트가 있는 페이지(짝수 번호)일 때만
  if (autoPlay && newPage % 2 === 0) {
    const textIndex = newPage / 2;
    if (texts[textIndex]) speakText(texts[textIndex], textIndex);
  }
};

const toggleTTS = () => {
  if (isSpeaking) stopAudio();
  else {
    const textIndex = Math.floor(currentPage / 2);
    if (texts[textIndex]) speakText(texts[textIndex], textIndex);
  }
};

  const narrow = pageSize ? pageSize.width < NARROW_PAGE : false;

  // 쪽 요소를 기억해 둔다. 렌더마다 새로 만들면 react-pageflip이 updateFromHtml로 쪽을 다시 읽으며 펼침면을
  // 아직 바뀌지 않은 현재 쪽 번호로 되돌려서, 여러 장을 건너뛰는 넘김(다시 보기의 flip(0))이 마지막 앞 장에서 끝난다.
  const pages = useMemo(
    () =>
      texts.flatMap((text, idx) => [
        <Page key={`img-${idx}`} $art $narrow={narrow}>
          <PageBody>
            <ArtFrame>
              <ArtImg src={images[idx]} alt={`${idx + 1}장 그림`} />
            </ArtFrame>
          </PageBody>
        </Page>,
        <Page key={`text-${idx}`} $narrow={narrow}>
          <PageBody>
            <StoryText $narrow={narrow}>{text}</StoryText>
          </PageBody>
        </Page>,
      ]),
    [texts, images, narrow]
  );

  if (loadError) {
    return (
      <BaseScreenLayout title="동화를 불러오지 못했어요.">
        <RoundedButton type="button" $primary onClick={() => navigate('/bookshelf')}>
          책장으로
        </RoundedButton>
      </BaseScreenLayout>
    );
  }

  if (!texts.length || !images.length) {
    return (
      <BaseScreenLayout title={title}>
        <StatusText role="status">불러오는 중</StatusText>
      </BaseScreenLayout>
    );
  }

  return (
    <BaseScreenLayout bare title={title}>
      <Stage ref={stageRef}>
        {pageSize && (
          <Book data-qa="book-spread">
            <HTMLFlipBook
              key={`${pageSize.width}x${pageSize.height}`}
              width={pageSize.width}
              height={pageSize.height}
              startPage={currentPage}
              size="fixed"
              maxShadowOpacity={0.5}
              showCover={false}
              mobileScrollSupport={false}
              useMouseEvents={true}
              drawShadow={true}
              flippingTime={1000}
              usePortrait={false}
              direction="rtl"
              ref={bookRef}
              onFlip={handleFlip}
            >
              {pages}
            </HTMLFlipBook>
          </Book>
        )}
      </Stage>

      <Reader>
        <ProgressInfo>
          {spread} / {texts.length} 장
          <StepDots current={spread} total={texts.length} />
        </ProgressInfo>
        <NavButton type="button" onClick={() => bookRef.current?.pageFlip().flipPrev()}>
          이전 장으로
        </NavButton>
        <RoundButton
          type="button"
          $primary
          aria-label={isSpeaking ? '읽기 멈추기' : '읽어주기'}
          onClick={toggleTTS}
        >
          {isSpeaking ? <PauseIcon /> : <SpeakerIcon />}
        </RoundButton>
        <NavButton type="button" onClick={() => bookRef.current?.pageFlip().flipNext()}>
          다음 장으로
        </NavButton>
      </Reader>

      {showFinishPopup && (
        <Overlay>
          <Dialog role="dialog" aria-modal="true" aria-labelledby="reading-finish-title">
            <PaperFrame $maxWidth="9rem">
              <FinishImg src={finishImg} alt="" />
            </PaperFrame>
            <DialogTitle id="reading-finish-title">이야기 끝!</DialogTitle>
            <DialogText>[{title}] 이야기를 끝까지 다 읽었어요!</DialogText>
            <RoundedButton
              type="button"
              $primary
              onClick={() => {
                setShowFinishPopup(false);
                setCurrentPage(0);
                const flipAPI = bookRef.current.pageFlip();
                if (flipAPI.getCurrentPageIndex() === 0) {
                  speakText(texts[0], 0); // 이미 첫 펼침면이라 flip 이벤트가 오지 않는다
                } else {
                  flipAPI.flip(0); // 되넘김이 끝나면 handleFlip(0)이 첫 장을 읽는다
                }
              }}
            >
              다시 보기
            </RoundedButton>
            <RoundedButton
              type="button"
              onClick={() => {
                stopAudio();
                navigate('/bookshelf');
              }}
            >
              책장으로
            </RoundedButton>
          </Dialog>
        </Overlay>
      )}
    </BaseScreenLayout>
  );
}
