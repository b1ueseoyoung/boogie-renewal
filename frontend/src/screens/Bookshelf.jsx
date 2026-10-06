import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Block from '../components/Block';
import RoundedButton from '../components/RoundedButton';
import { PaperFrame } from '../components/BaseScreenLayout';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import defaultImg from '../assets/images/testImg.png';
import { useSetRecoilState } from 'recoil';
import { storyInfoState,favoriteStoryIdsState } from '../recoil/atoms';

const UNTITLED = '제목 없는 동화';

const BookshelfContainer = styled.div`
  min-height: calc(var(--vh, 1vh) * 100);
  padding-bottom: 5rem;
`;

const Main = styled.main`
  width: min(74rem, 100%);
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space[5]} ${theme.space[4]} ${theme.space[6]}`};
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const Chips = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  flex: 1 1 16rem;
  min-width: 0;
  overflow-x: auto;
  /* 주인공이 많으면 옆으로 넘긴다. 오른쪽 끝 space[7]을 흐려서 칩이 칸 경계에서 칼로 자른 듯 끊겨 보이지 않게 하고,
     같은 폭만큼 끝 여백을 두어 끝까지 넘기면 마지막 칩이 흐림 밖에 온전히 보인다. 마스크는 알파만 쓰므로 색 토큰은 불투명 값이면 된다. */
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[7]} ${theme.space[2]} ${theme.space[1]}`};
  scroll-padding-inline-start: ${({ theme }) => theme.space[1]};
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.rule} transparent`};
  mask-image: ${({ theme }) => `linear-gradient(to right, ${theme.colors.ink} calc(100% - ${theme.space[7]}), transparent)`};
`;

const Chip = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  flex: none;
  min-height: ${({ theme }) => theme.tap};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.base};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme, 'aria-pressed': pressed }) => (pressed ? theme.colors.accentPale : theme.colors.surface)};
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.btn};
  cursor: pointer;
  white-space: nowrap;
  scroll-snap-align: start;
  transition: background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  &:hover {
    background: ${({ theme }) => theme.colors.accentPale};
  }
`;

const ChipImg = styled.img`
  width: 2rem;
  height: 2rem;
  object-fit: cover;
  object-position: top;
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.surface2};
`;

const EditButton = styled(RoundedButton)`
  width: auto;
  margin: 0;
  font-size: ${({ theme }) => theme.text.base};
`;

const SectionTitle = styled.h2`
  font-size: ${({ theme }) => theme.text['2xl']};
  margin-bottom: ${({ theme }) => theme.space[5]};
`;

const Accent = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(10rem, 100%), 1fr));
  gap: ${({ theme }) => `${theme.space[6]} ${theme.space[4]}`};
  align-items: start;
`;

const EmptyBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  max-width: 35rem;
  margin: ${({ theme }) => theme.space[6]} auto 0;
  padding: ${({ theme }) => `${theme.space[6]} ${theme.space[5]}`};
  text-align: center;
  background: ${({ theme }) => theme.colors.surface};
  border: 0.125rem dashed ${({ theme }) => theme.colors.pencil};
  border-radius: ${({ theme }) => theme.radius.card};
`;

// 불러오기 실패: GenerationError(시안 C .errorcard)처럼 보조면에 빨간펜 왼쪽 여백선. 빈 상태의 점선 상자와 구분된다.
const ErrorBox = styled(EmptyBox)`
  background: ${({ theme }) => theme.colors.surface2};
  border: ${({ theme }) => theme.border.thick};
  border-left: 0.375rem solid ${({ theme }) => theme.colors.redpen};
`;

// GenerationError처럼 문장 중간에서 줄이 갈리지 않게 한다
const Nowrap = styled.span`
  white-space: nowrap;
`;

const EmptyTitle = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
`;

const EmptyText = styled.p`
  color: ${({ theme }) => theme.colors.ink};
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
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.card};
  text-align: center;
`;

const DialogImg = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.tag};
`;

const DialogTitle = styled.h2`
  margin: ${({ theme }) => `${theme.space[5]} 0 ${theme.space[4]}`};
  font-size: ${({ theme }) => theme.text.xl};
  line-height: ${({ theme }) => theme.leading.tight};
  overflow-wrap: anywhere;
`;

export default function Bookshelf() {
  const [storyList, setStoryList] = useState([]);
  const [characterList, setCharacterList] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [selectedCharacterName, setSelectedCharacterName] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const navigate = useNavigate();
  const setFavoriteStoryIds = useSetRecoilState(favoriteStoryIdsState);
  const setStoryInfoState = useSetRecoilState(storyInfoState);
  const fetchData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/mypage/story`);
      const stories = res.data.stories || [];

      setStoryList(stories);
      setStoryInfoState(stories); //즐겨찾기를 위해 리코일에 저장
      setCharacterList(res.data.characters || []);

      const favoriteIds = stories.filter(s => s.favorite).map(s => s.storyId);
      setFavoriteStoryIds(favoriteIds);
    } catch (err) {
      console.error('데이터 불러오기 실패', err);
      setLoadError(true); // 실패를 빈 책장처럼 보이지 않게 한다
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBlockClick = (story) => setSelectedStory(story);
  const handleClosePopup = () => setSelectedStory(null);

  useEffect(() => {
    if (!selectedStory) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedStory(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedStory]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}년 ${month}월 ${day}일`;
  };

  const filteredStoryList = selectedCharacterId
  ? storyList.filter((story) =>
      String(story.charId) === String(selectedCharacterId)
    )
  : storyList;

  const selectAll = () => {
    setSelectedCharacterId(null);
    setSelectedCharacterName(null);
  };

  const selectedTitle = selectedStory ? selectedStory.title || UNTITLED : '';

  return (
    <BookshelfContainer>
      <Header pageName="내 책장" />

      <Main>
        {loading ? (
          <EmptyText role="status">책장을 여는 중이에요</EmptyText>
        ) : loadError ? (
          <ErrorBox role="alert">
            <EmptyTitle>책장을 불러오지 못했어요.</EmptyTitle>
            <EmptyText><Nowrap>저장된 동화는 그대로 있어요.</Nowrap> <Nowrap>잠시 뒤 다시 시도해 주세요.</Nowrap></EmptyText>
            <RoundedButton type="button" $primary onClick={fetchData}>
              다시 시도
            </RoundedButton>
          </ErrorBox>
        ) : characterList.length > 0 ? (
          <>
            <Toolbar>
              <Chips role="group" aria-label="주인공으로 거르기">
                <Chip type="button" aria-pressed={selectedCharacterId === null} onClick={selectAll}>
                  전체
                </Chip>
                {characterList.map((char) => (
                  <Chip
                    key={char.charId}
                    type="button"
                    aria-pressed={selectedCharacterId === char.charId}
                    onClick={() => {
                      setSelectedCharacterId(char.charId);
                      setSelectedCharacterName(char.charName);
                    }}
                  >
                    <ChipImg src={char.charImg || defaultImg} alt="" />
                    {char.charName}
                  </Chip>
                ))}
              </Chips>
              {selectedCharacterId === null && (
                <EditButton type="button" onClick={() => navigate('/edit-bookshelf')}>
                  편집하기
                </EditButton>
              )}
            </Toolbar>

            {selectedCharacterId !== null && filteredStoryList.length > 0 && (
              <SectionTitle>
                <Accent>{selectedCharacterName}</Accent>(이)가 나오는 동화들
              </SectionTitle>
            )}

            {filteredStoryList.length > 0 ? (
              <Grid>
                {filteredStoryList.map((story) => (
                  <Block
                    key={story.storyId}
                    blockImg={story.coverImg || defaultImg}
                    blockName={story.title || UNTITLED}
                    creationDate={formatDate(story.creationDate)}
                    storyId={story.storyId}
                    showFavorite={true}
                    onClick={() => handleBlockClick(story)}
                  />
                ))}
              </Grid>
            ) : (
              <EmptyBox>
                <EmptyTitle>선택한 캐릭터의 동화가 없어요.</EmptyTitle>
                <EmptyText>다른 캐릭터를 선택해보세요!</EmptyText>
                <RoundedButton type="button" $primary onClick={selectAll}>
                  전체 보기
                </RoundedButton>
              </EmptyBox>
            )}
          </>
        ) : (
          <EmptyBox>
            <EmptyTitle>등록된 캐릭터가 없습니다.</EmptyTitle>
            <EmptyText>캐릭터를 등록해주세요!</EmptyText>
            <RoundedButton type="button" $primary onClick={() => navigate('/create-character')}>
              캐릭터 등록
            </RoundedButton>
          </EmptyBox>
        )}
      </Main>

      {selectedStory && (
        <Overlay onClick={handleClosePopup}>
          <Dialog
            role="dialog"
            aria-modal="true"
            aria-labelledby="bookshelf-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <PaperFrame $maxWidth="11rem">
              <DialogImg src={selectedStory.coverImg || defaultImg} alt="" />
            </PaperFrame>
            <DialogTitle id="bookshelf-dialog-title">{selectedTitle}</DialogTitle>
            <RoundedButton
              type="button"
              $primary
              autoFocus
              onClick={() => {
                handleClosePopup();
                navigate(`/reading?file=${encodeURIComponent(selectedStory.content)}&title=${encodeURIComponent(selectedTitle)}`);
              }}
            >
              열기
            </RoundedButton>
            <RoundedButton type="button" onClick={handleClosePopup}>
              닫기
            </RoundedButton>
          </Dialog>
        </Overlay>
      )}

      <BottomNav />
    </BookshelfContainer>
  );
}
