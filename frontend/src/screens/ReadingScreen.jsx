import React, { useState, useRef, useEffect, useMemo } from 'react';
import { speak, stopSpeaking } from '../utils/speak';
import styled from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import HTMLFlipBook from 'react-pageflip';
import BaseScreenLayout, { SunDisc } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import Dialog from '../components/Dialog';
import Skeleton from '../components/Skeleton';
import { LoadError } from '../components/Notice';
import { UNTITLED } from '../components/Placeholder';
import { fadeIn } from '../components/Card';
import finishImg from '../assets/images/finish.png';

// 어느 폭에서나 그림 쪽 | 글 쪽을 펼쳐 본다(자동 읽기가 그림 쪽에서 그 장의 글을 읽고 다음 펼침면으로 넘기는 흐름에 맞춘다)
const PAGE_RATIO = 4 / 3; // 쪽의 세로/가로
const NARROW_PAGE_REM = 15; // 쪽 폭이 이보다 좁으면(휴대폰) 쪽을 세로로 길게 두고 글을 한 단계 줄인다
const NARROW_MAX_RATIO = 2.75; // 좁은 쪽은 화면 높이가 남으면 세로를 이만큼까지 늘린다(펼침면 전체는 3:4 안팎)
const MIN_PAGE_REM = 16; // 쪽 높이의 아래 한계
// 책 밖 세로 여백의 합(rem): 화면 위·아래 여백, 머리줄 아래, 책 위, 버튼 줄 위
const CHROME_REM = 6;

const Stage = styled.div`
  width: 100%;
  min-width: 0;
`;

// 펼친 그림책: 그림자 없이 바깥 1px line으로 바탕과 나눈다.
// border를 쓰면 fit-content 폭이 2px 늘어 고정 폭 책이 잘리므로, 크기를 바꾸지 않는 바깥 선(box-shadow)으로 그린다
const Book = styled.div`
  width: fit-content;
  max-width: 100%;
  margin: ${({ theme }) => theme.space[2]} auto 0;
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.ring};
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
  padding: ${({ theme, $art, $narrow }) => ($narrow ? theme.space[3] : $art ? theme.space[4] : theme.space[6])};
  background: ${({ theme, $art }) => ($art ? theme.colors.surface2 : theme.colors.surface)};
  /* 글 쪽의 왼쪽(가운데 접힌 곳)에 옅은 그늘 */
  box-shadow: ${({ theme, $art }) => ($art ? 'none' : theme.shadow.gutter)};
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

// 이야기 글: theme.text.story. 휴대폰의 좁은 쪽($narrow)은 한 쪽에 한 장 글이 들어가도록 sm으로 줄인다
// (책 위에서는 손가락 끌기가 쪽 넘기기라 글을 스크롤할 수 없다). 넘치면 마우스로만 쪽 안에서 스크롤된다
const StoryText = styled.p`
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: ${({ theme }) => `${theme.colors.lineStrong} transparent`};
  font-size: ${({ theme, $narrow }) => ($narrow ? theme.text.sm : theme.text.story)};
  line-height: ${({ theme, $narrow }) => ($narrow ? 1.6 : theme.leading.body)};
  text-align: start;
  text-wrap: pretty;
  white-space: pre-wrap;
  color: ${({ theme }) => theme.colors.ink};
`;

// 이전 장 | 읽어주기 | 다음 장
const Reader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[5]};

  & > * {
    flex: 0 1 auto;
    min-width: 0;
  }
`;

// 아이콘만 있는 정사각 읽어주기 버튼(옆 버튼과 같은 둥근 사각 모서리)
const RoundButton = styled(RoundedButton)`
  flex: none;
  width: 3.25rem;
  height: 3.25rem;
  min-height: 3.25rem;
  padding: 0;
  border-radius: ${({ theme }) => theme.radius.btn};

  & svg {
    width: 1.375rem;
    height: 1.375rem;
  }
`;

// 불러오는 동안 같은 자리에 비어 있는 펼친 책을 둔다(휴대폰은 세로로 긴 두 쪽)
const BookSkeleton = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: min(100%, 52rem);
  aspect-ratio: 3 / 2;
  margin: ${({ theme }) => theme.space[2]} auto 0;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.ring};
  animation: ${fadeIn} ${({ theme }) => `${theme.motion.enter} ${theme.motion.ease}`};

  @media ${({ theme }) => theme.mq.phone} {
    aspect-ratio: 3 / 4;
  }
`;

const ArtSkeleton = styled(Skeleton)`
  border-radius: 0;
`;

const SkeletonText = styled.span`
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.space[3]};
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
  box-shadow: ${({ theme }) => theme.shadow.gutter};
`;

// 다 읽은 책 이름: 안내 글(inkSoft regular) 사이에서 ink semibold로 드러낸다
const BookName = styled.span`
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
`;

const SpeakerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 5a9 9 0 0 1 0 14" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M9 5v14" />
    <path d="M15 5v14" />
  </svg>
);

export default function ReadingScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileUrl = new URLSearchParams(location.search).get('file')?.replace(/^"|"$/g, '');
  const titleFromQuery = new URLSearchParams(location.search).get('title') || '';

  const [title, setTitle] = useState(titleFromQuery || UNTITLED);
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
  const readerRef = useRef(null);
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

        setTitle(data.title || titleFromQuery || UNTITLED);
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

  // 펼친 두 쪽이 한 화면에 들어가도록 쪽 크기를 다시 계산한다. 크기가 바뀌면 key로 책을 다시 만들고 startPage로 보던 쪽을 잇는다.
  // 높이는 메뉴 막대가 없는 화면에서 머리줄과 버튼 줄을 뺀 나머지다. 쪽이 좁으면(휴대폰) 남는 높이만큼 쪽을 세로로 늘린다.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const updateSize = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const head = stage.closest('section')?.querySelector('header')?.offsetHeight || 0;
      const reader = readerRef.current?.offsetHeight || 0;
      const maxHeight = Math.max(MIN_PAGE_REM * rem, window.innerHeight - head - reader - CHROME_REM * rem);
      const width = Math.floor(Math.min(stage.clientWidth / 2, maxHeight / PAGE_RATIO));
      const narrow = width < NARROW_PAGE_REM * rem;
      const height = Math.floor(narrow ? Math.min(maxHeight, width * NARROW_MAX_RATIO) : width * PAGE_RATIO);
      setPageSize(prev =>
        prev && prev.width === width && prev.height === height && prev.narrow === narrow
          ? prev
          : { width, height, narrow }
      );
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

  const narrow = pageSize ? pageSize.narrow : false;

  // 첫·마지막 펼침면에서는 넘길 쪽이 없다(넘기기는 원래 아무 일도 하지 않는다). 버튼은 비활성으로 보이되,
  // 누르던 버튼이 포커스를 잃지 않도록 disabled 대신 aria-disabled를 쓴다
  const atStart = spread <= 1;
  const atEnd = spread >= texts.length;

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
      <BaseScreenLayout bare>
        <LoadError title="동화를 불러오지 못했어요." actionText="책장으로" onAction={() => navigate('/bookshelf')} />
      </BaseScreenLayout>
    );
  }

  if (!texts.length || !images.length) {
    return (
      <BaseScreenLayout bare title={titleFromQuery || undefined}>
        <BookSkeleton role="status">
          <ArtSkeleton />
          <SkeletonText>불러오는 중</SkeletonText>
        </BookSkeleton>
      </BaseScreenLayout>
    );
  }

  return (
    <BaseScreenLayout bare title={title} progressCurrent={spread} progressTotal={texts.length} progressUnit="장">
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

      <Reader ref={readerRef}>
        <RoundedButton
          type="button"
          $inline
          aria-disabled={atStart || undefined}
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
        >
          이전 장으로
        </RoundedButton>
        <RoundButton
          type="button"
          $primary
          $inline
          aria-label={isSpeaking ? '읽기 멈추기' : '읽어주기'}
          onClick={toggleTTS}
        >
          {isSpeaking ? <PauseIcon /> : <SpeakerIcon />}
        </RoundButton>
        <RoundedButton
          type="button"
          $inline
          aria-disabled={atEnd || undefined}
          onClick={() => bookRef.current?.pageFlip().flipNext()}
        >
          다음 장으로
        </RoundedButton>
      </Reader>

      {/* 원래처럼 두 버튼으로만 닫는다(onClose를 넘기지 않아 Escape·막 누르기를 무시한다) */}
      <Dialog
        open={showFinishPopup}
        title="이야기 끝!"
        media={
          <SunDisc $size="8rem" $fill="86%" aria-hidden="true">
            <img src={finishImg} alt="" />
          </SunDisc>
        }
        actions={
          <>
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
          </>
        }
      >
        <p>
          <BookName>{title}</BookName> 이야기를 끝까지 다 읽었어요!
        </p>
      </Dialog>
    </BaseScreenLayout>
  );
}
