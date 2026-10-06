import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Lottie from 'react-lottie-player';
import introAnimation from '../assets/introAnimation1.json';
import { rise } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';

// 한 화면에 첫 화면과 책 줄이 함께 들어오도록 크기를 화면 높이(vh)에도 맞춘다
const Page = styled.main`
  width: min(74rem, 100%);
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space[5]} ${theme.space[5]} 5.5rem`};

  @media (min-width: 56rem) {
    padding: 5.75rem ${({ theme }) => theme.space[5]} ${({ theme }) => theme.space[5]};
  }
`;

const Hero = styled.section`
  display: grid;
  gap: ${({ theme }) => theme.space[6]};
  align-items: center;
  grid-template-columns: minmax(0, 1fr);
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`};

  @media (max-width: 55.99rem) {
    gap: ${({ theme }) => theme.space[4]};
  }

  @media (min-width: 56rem) {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: ${({ theme }) => theme.space[8]};
  }
`;

const Copy = styled.div`
  min-width: 0;

  @media (max-width: 55.99rem) {
    order: 2;
  }
`;

const Kicker = styled.p`
  display: inline-block;
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.sunPale};
  border-radius: ${({ theme }) => theme.radius.btn};

  @media (max-width: 55.99rem) {
    display: none;
  }
`;

const HeroTitle = styled.h1`
  margin-top: ${({ theme }) => theme.space[3]};
  font-size: min(${({ theme }) => theme.text.hero}, 9vh);

  @media (max-width: 55.99rem) {
    margin-top: 0;
    font-size: min(${({ theme }) => theme.text.hero}, 7vh);
  }
  line-height: 1.12;
  white-space: pre-line;
  overflow-wrap: anywhere;
`;

const Lead = styled.p`
  margin-top: ${({ theme }) => theme.space[4]};
  max-width: 30ch;
  font-size: ${({ theme }) => theme.text.lg};

  @media (max-width: 55.99rem) {
    margin-top: ${({ theme }) => theme.space[3]};
    font-size: ${({ theme }) => theme.text.base};
    line-height: 1.6;
  }
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const Em = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-family: ${({ theme }) => theme.fonts.display};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};
  align-items: flex-start;
  margin-top: ${({ theme }) => theme.space[5]};

  /* 공용 버튼의 '붙은 두 번째 버튼 위 여백'을 이겨야 해서 버튼 컴포넌트를 두 번 적어 우선순위를 높인다 */
  & > ${RoundedButton}, & > ${RoundedButton} + ${RoundedButton} {
    width: auto;
    margin: 0 0 0.25rem;
  }

  @media (max-width: 30rem) {
    & > ${RoundedButton} {
      flex: 1 1 0;
      padding-inline: ${({ theme }) => theme.space[3]};
    }
  }
`;

const Stage = styled.div`
  position: relative;
  width: min(100%, 28rem, 50vh);

  @media (max-width: 55.99rem) {
    width: min(100%, 22vh);
  }

  margin: 0 auto;
  aspect-ratio: 1;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.sunPale};

  &::before {
    content: '';
    position: absolute;
    inset: 12%;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.sun};
    opacity: 0.35;
  }
`;

const Mascot = styled.div`
  position: absolute;
  inset: 4% 4% 0;
`;

const HammerHotspot = styled.div`
  position: absolute;
  left: 65%;
  top: 50%;
  width: 22%;
  height: 40%;
  cursor: pointer;
`;

const Shelf = styled.section`
  margin-top: ${({ theme }) => theme.space[5]};
  animation: ${rise} ${({ theme }) => `${theme.motion.enter} ${theme.motion.out}`} 120ms backwards;
`;

const ShelfHead = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  padding-bottom: ${({ theme }) => theme.space[3]};
  border-bottom: ${({ theme }) => theme.border.thick};
`;

const ShelfTitle = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
`;

const TextLink = styled.button`
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.accent};
`;

// 책은 한 줄로 늘어놓고, 넘치면 옆으로 넘겨 본다
const Books = styled.ul`
  display: flex;
  gap: ${({ theme }) => theme.space[5]};
  margin-top: ${({ theme }) => theme.space[4]};
  padding-bottom: ${({ theme }) => theme.space[2]};
  overflow-x: auto;
  list-style: none;
`;

const BookButton = styled.button`
  display: block;
  width: clamp(6.5rem, 15vh, 9rem);

  @media (max-width: 55.99rem) {
    width: clamp(5rem, 11vh, 7rem);
  }
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
`;

const Cover = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: ${({ theme }) => `0.375rem ${theme.radius.art} ${theme.radius.art} 0.375rem`};
  background: ${({ theme }) => theme.colors.surface2};
  box-shadow: ${({ theme }) => theme.shadow.art};
`;

const BookTitle = styled.span`
  display: block;
  margin-top: ${({ theme }) => theme.space[3]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.ink};
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
    fetch(`${process.env.REACT_APP_API_BASE_URL}/mypage/story`)
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
    <Page>
      <Hero>
        <Copy>
          <Kicker>내가 주인공이 되는 그림책</Kicker>
          <HeroTitle>{'직접 이야기를\n만들어 봐요!'}</HeroTitle>
          <Lead>
            사진 한 장으로 주인공을 만들고, 고르는 대로 이야기가 이어져요. 도깨비의 <Em>방망이</Em>를 두드리면 시작해요.
          </Lead>
          <Actions>
            <RoundedButton $primary type="button" onClick={knock}>
              방망이 두드리기
            </RoundedButton>
            <RoundedButton type="button" onClick={() => navigate('/bookshelf')}>
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
              style={{ width: '100%', height: '100%' }}
            />
            <HammerHotspot onClick={knock} />
          </Mascot>
        </Stage>
      </Hero>

      {books.length > 0 && (
        <Shelf aria-labelledby="recent-books">
          <ShelfHead>
            <ShelfTitle id="recent-books">최근에 만든 책</ShelfTitle>
            <TextLink type="button" onClick={() => navigate('/bookshelf')}>
              전체 보기
            </TextLink>
          </ShelfHead>
          <Books>
            {books.map((book) => (
              <li key={book.storyId}>
                <BookButton type="button" onClick={() => open(book)}>
                  <Cover src={book.coverImg} alt="" />
                  <BookTitle>{book.title}</BookTitle>
                </BookButton>
              </li>
            ))}
          </Books>
        </Shelf>
      )}
    </Page>
  );
}
