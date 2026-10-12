import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Lottie from 'react-lottie-player';
import introAnimation from '../assets/introAnimation1.json';
import { rise } from '../components/Card';
import PageShell, { ShelfGrid } from '../components/PageShell';
import RoundedButton from '../components/RoundedButton';
import TextButton from '../components/TextButton';
import Block from '../components/Block';
import Wordmark from '../components/Wordmark';
import { UNTITLED } from '../components/Placeholder';

// 홈은 스크롤 없이 한 화면에 들어오게 한다: 틀이 화면 높이를 채우고(세로 흐름), 남는 높이는 첫 화면(Hero)이 가운데 정렬로 나눠 갖는다.
// 도깨비와 책 표지는 화면 높이(--vh, App이 innerHeight로 잰다)에 맞춰 줄어든다
const HomeShell = styled(PageShell)`
  display: flex;
  flex-direction: column;
  padding-top: calc(env(safe-area-inset-top) + ${({ theme }) => theme.space[4]});
  padding-bottom: calc(
    ${({ theme }) => theme.layout.navH} + env(safe-area-inset-bottom) + ${({ theme }) => theme.space[3]}
  );

  @media ${({ theme }) => theme.mq.wide} {
    padding-top: calc(${({ theme }) => theme.layout.navHWide} + ${({ theme }) => theme.space[5]});
    padding-bottom: ${({ theme }) => theme.space[5]};
  }
`;

// 첫 화면: 넓으면 글(왼쪽) | 도깨비(오른쪽), 좁으면 '꿈도깨비' → 도깨비 → 글을 가운데 정렬로 쌓는다.
// 마크업은 글이 먼저라 넓은 화면의 포커스 순서(버튼 → 방망이)가 보이는 순서와 같다
const Hero = styled.section`
  flex: 1 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
  justify-items: center;
  gap: ${({ theme }) => theme.space[3]};
  text-align: center;

  @media ${({ theme }) => theme.mq.wide} {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    align-items: center;
    justify-items: stretch;
    gap: ${({ theme }) => theme.space[8]};
    text-align: start;
  }
`;

// 휴대폰 맨 위 이름(공통 Wordmark, 메뉴 막대와 같은 모양). 넓은 화면은 위 메뉴 막대에 같은 이름이 있어 숨긴다
const Brand = styled(Wordmark)`
  order: -2;

  @media ${({ theme }) => theme.mq.wide} {
    display: none;
  }
`;

// 글 열은 줄 폭을 다 쓴다(가운데 정렬은 안의 요소가 맡는다). 그래야 휴대폰에서 버튼 줄이 화면 폭을 채운다
const Copy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-self: stretch;
  min-width: 0;

  @media ${({ theme }) => theme.mq.wide} {
    align-items: flex-start;
  }
`;

// 배지: 옅은 파랑 바탕 + accentDeep(7.1:1) 13px semibold. 목록 화면의 eyebrow와 같은 모양.
// 넓은 화면은 큰 제목에 맞춰 한 단계(14px) 키운다
const Kicker = styled.p`
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.accentPale};
  color: ${({ theme }) => theme.colors.accentDeep};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.caption};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};

  @media ${({ theme }) => theme.mq.wide} {
    font-size: ${({ theme }) => theme.text.sm};
  }
`;

// 화면이 낮으면 제목도 줄여서 첫 화면 안에 버튼까지 들어오게 한다
const HeroTitle = styled.h1`
  margin-top: ${({ theme }) => theme.space[3]};
  font-size: min(${({ theme }) => theme.text.hero}, 9vh);
  line-height: 1.12;
  white-space: pre-line;
  overflow-wrap: anywhere;
  text-wrap: balance;

  @media ${({ theme }) => theme.mq.wide} {
    margin-top: ${({ theme }) => theme.space[4]};
  }
`;

const Lead = styled.p`
  max-width: 30ch;
  margin-top: ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.text.md};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.inkSoft};

  @media ${({ theme }) => theme.mq.wide} {
    margin-top: ${({ theme }) => theme.space[4]};
    font-size: ${({ theme }) => theme.text.lg};
    line-height: ${({ theme }) => theme.leading.body};
  }
`;

// 강조 낱말: 파란 semibold (바탕 위 4.78:1)
const Em = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: ${({ theme }) => theme.weight.semibold};
`;

// 버튼 두 개를 한 줄에. 휴대폰에서는 줄을 꽉 채우되 글자 길이만큼 폭을 나눠 글자가 줄바꿈되지 않게 한다
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[4]};

  @media ${({ theme }) => theme.mq.wide} {
    justify-content: flex-start;
    margin-top: ${({ theme }) => theme.space[6]};
  }

  @media ${({ theme }) => theme.mq.phone} {
    align-self: stretch;

    & > * {
      flex: 1 1 auto;
    }
  }
`;

// 도깨비 무대: 옅은 파랑 원 두 겹 위의 도깨비. 좁으면 글 위로 올리고, 화면 높이에 맞춰 크기를 줄인다
const Stage = styled.div`
  position: relative;
  order: -1;
  /* 휴대폰: 화면 높이에서 글·버튼·책 줄·탭 막대 높이(약 41rem)를 뺀 만큼, 5rem~15rem */
  width: min(100%, clamp(5rem, calc(var(--vh, 1vh) * 100 - 41rem), 15rem));
  aspect-ratio: 1;
  margin-inline: auto;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.accentPale};

  &::before {
    content: '';
    position: absolute;
    inset: 12%;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accentTrack};
    opacity: 0.6;
  }

  @media ${({ theme }) => theme.mq.wide} {
    order: 0;
    /* 넓은 화면: 글 열 높이(약 21rem)를 넘지 않게 */
    width: min(100%, clamp(12rem, calc(var(--vh, 1vh) * 100 - 26rem), 21rem));
  }
`;

const Mascot = styled.div`
  position: absolute;
  inset: 4% 4% 0;
`;

// 도깨비 방망이 위의 누르는 자리. 키보드로도 누를 수 있게 버튼으로 둔다(누르는 자리는 44px 이상)
const HammerButton = styled.button`
  position: absolute;
  left: 65%;
  top: 50%;
  width: 22%;
  height: 40%;
  min-width: ${({ theme }) => theme.tap};
  min-height: ${({ theme }) => theme.tap};
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.card};
  background: none;
  cursor: pointer;

  /* 그림 위의 보이지 않는 자리라 눌러도 작아지지 않는다(전역 누름 반응보다 우선하게 클래스를 세 번 적는다) */
  &&&:active {
    scale: none;
  }
`;

const Shelf = styled.section`
  flex: none;
  margin-top: ${({ theme }) => theme.space[4]};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`} 120ms backwards;

  @media ${({ theme }) => theme.mq.wide} {
    margin-top: ${({ theme }) => theme.space[6]};
  }
`;

const ShelfHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

const ShelfTitle = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
`;

// 글자 버튼의 안쪽 여백만큼 바깥으로 내어 글자 끝을 책 줄 끝에 맞춘다
const AllLink = styled(TextButton)`
  flex: none;
  margin-right: calc(-1 * ${({ theme }) => theme.space[2]});
`;

// 책 줄: 넓으면 책장과 같은 격자, 좁으면 한 줄로 늘어놓고 옆으로 넘겨 본다(화면 끝까지 닿게, 한 권씩 멈춘다)
const Books = styled(ShelfGrid)`
  --cover-w: 5.25rem;
  list-style: none;

  @media ${({ theme }) => theme.mq.wide} {
    --cover-w: clamp(6rem, calc((var(--vh, 1vh) * 100 - 39rem) * 0.75), 10.5rem);
    grid-template-columns: repeat(auto-fill, var(--cover-w));
    justify-content: start;
  }

  & > li {
    min-width: 0;
  }

  @media ${({ theme }) => theme.mq.narrow} {
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: var(--cover-w);
    margin-inline: calc(-1 * ${({ theme }) => theme.layout.gutter});
    padding: ${({ theme }) => `${theme.space[1]} ${theme.layout.gutter} ${theme.space[2]}`};
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: ${({ theme }) => theme.layout.gutter};

    & > li {
      scroll-snap-align: start;
    }
  }
`;

const RECENT = 4;

export default function IntroScreen() {
  const navigate = useNavigate();
  const lottieRef = useRef(null);
  const [play, setPlay] = useState(false);
  const [books, setBooks] = useState([]);

  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.pause();
      lottieRef.current.goToAndStop(0, true);
    }
  }, []);

  useEffect(() => {
    if (play && lottieRef.current) {
      lottieRef.current.play();
      const timer = setTimeout(() => {
        navigate('character-select');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [play, navigate]);

  // 최근에 만든 책. 못 불러오면 줄을 보이지 않는다(홈의 주된 일은 새 이야기 만들기다)
  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.REACT_APP_API_BASE_URL}/mypage/story`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.stories)) setBooks(data.stories.slice(-RECENT).reverse());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const knock = () => {
    if (!play) setPlay(true);
  };

  const open = (book) =>
    navigate(`/reading?file=${encodeURIComponent(book.content)}&title=${encodeURIComponent(book.title)}`);

  return (
    <HomeShell>
      <Hero>
        <Brand />
        <Copy>
          <Kicker>내가 주인공이 되는 그림책</Kicker>
          <HeroTitle>{'직접 이야기를\n만들어 봐요!'}</HeroTitle>
          <Lead>
            사진 한 장으로 주인공을 만들고, 고르는 대로 이야기가 이어져요. 도깨비의 <Em>방망이</Em>를 두드리면 시작해요.
          </Lead>
          <Actions>
            <RoundedButton $primary $inline type="button" onClick={knock}>
              방망이 두드리기
            </RoundedButton>
            <RoundedButton $inline type="button" onClick={() => navigate('/bookshelf')}>
              내 책장 보기
            </RoundedButton>
          </Actions>
        </Copy>
        <Stage>
          <Mascot>
            <Lottie
              ref={lottieRef}
              animationData={introAnimation}
              loop={false}
              play={play}
              aria-hidden="true"
              style={{ width: '100%', height: '100%' }}
            />
            <HammerButton type="button" aria-label="방망이 두드리기" onClick={knock} />
          </Mascot>
        </Stage>
      </Hero>

      {books.length > 0 && (
        <Shelf aria-labelledby="recent-books">
          <ShelfHead>
            <ShelfTitle id="recent-books">최근에 만든 책</ShelfTitle>
            <AllLink onClick={() => navigate('/bookshelf')}>전체 보기</AllLink>
          </ShelfHead>
          <Books as="ul">
            {books.map((book) => (
              <li key={book.storyId}>
                <Block blockImg={book.coverImg} blockName={book.title || UNTITLED} hideFavorite onClick={() => open(book)} />
              </li>
            ))}
          </Books>
        </Shelf>
      )}
    </HomeShell>
  );
}
