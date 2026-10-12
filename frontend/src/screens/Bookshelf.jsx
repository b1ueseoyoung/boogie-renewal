import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { storyInfoState,favoriteStoryIdsState } from '../recoil/atoms';
import PageShell, { PageHeader, ShelfGrid } from '../components/PageShell';
import Block from '../components/Block';
import Chip from '../components/Chip';
import Dialog from '../components/Dialog';
import Empty from '../components/Empty';
import RoundedButton from '../components/RoundedButton';
import Skeleton from '../components/Skeleton';
import { LoadError } from '../components/Notice';
import { CoverPlate, coverPlaceholder, UNTITLED } from '../components/Placeholder';

// 주인공 거르기 칩 줄. 휴대폰에서는 화면 끝까지 닿는 한 줄을 옆으로 넘기고(오른쪽 끝은 흐리게), 넓은 화면에서는 여러 줄로 감는다.
// 마스크는 알파만 쓰므로 색 토큰은 불투명 값이면 된다. 위아래 여백은 칩의 포커스 고리 자리다.
const Filters = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  margin: ${({ theme }) => `0 calc(-1 * ${theme.layout.gutter}) ${theme.space[5]}`};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[7]} ${theme.space[2]} ${theme.layout.gutter}`};
  overflow-x: auto;
  scroll-padding-inline-start: ${({ theme }) => theme.layout.gutter};
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.colors.lineStrong} transparent`};
  mask-image: ${({ theme }) => `linear-gradient(to right, ${theme.colors.ink} calc(100% - ${theme.space[7]}), transparent)`};

  & > * {
    scroll-snap-align: start;
  }

  @media ${({ theme }) => theme.mq.wide} {
    flex-wrap: wrap;
    margin: ${({ theme }) => `0 calc(-1 * ${theme.space[2]}) ${theme.space[6]}`};
    padding: ${({ theme }) => theme.space[2]};
    overflow-x: visible;
    mask-image: none;
  }
`;

const SectionTitle = styled.h2`
  margin-bottom: ${({ theme }) => theme.space[5]};
  font-size: ${({ theme }) => theme.text.xl};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
`;

const Accent = styled.span`
  color: ${({ theme }) => theme.colors.accent};
`;

// 불러오는 동안: 책 격자 자리에 빈 표지가 은은하게 깜빡인다(공통 Skeleton)
const LoadingText = styled.p`
  margin-bottom: ${({ theme }) => theme.space[5]};
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const GhostCover = styled(Skeleton)`
  aspect-ratio: 3 / 4;
`;

const GhostLine = styled(Skeleton)`
  width: 70%;
  height: ${({ theme }) => theme.text.sm};
  margin: ${({ theme }) => `${theme.space[3]} auto 0`};
`;

// 편집하기: 전체 보기에서만 누를 수 있다. 주인공을 고르면 원래처럼 사라지되, 자리는 남겨 칩 줄이 위로 뛰지 않게 한다
const EditSlot = styled.span`
  display: contents;

  & > * {
    visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
  }
`;

// GenerationError처럼 문장 중간에서 줄이 갈리지 않게 한다
const Nowrap = styled.span`
  white-space: nowrap;
`;

// 날짜: 흰 대화상자 위라 inkMuted(4.62:1). 줄거리(inkSoft)와 나뉘게 medium
const DialogDate = styled.p`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: ${({ theme }) => theme.weight.medium};
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
  const selectedDate = selectedStory ? formatDate(selectedStory.creationDate) : '';

  // 편집은 전체 보기에서만 한다(주인공을 고르면 보이지 않는다)
  const showEdit = !loading && !loadError && characterList.length > 0;

  return (
    <PageShell>
      <PageHeader
        title="내 책장"
        actions={
          showEdit && (
            <EditSlot $hidden={selectedCharacterId !== null}>
              <RoundedButton type="button" $size="sm" $inline onClick={() => navigate('/edit-bookshelf')}>
                편집하기
              </RoundedButton>
            </EditSlot>
          )
        }
      />

      {loading ? (
        <>
          <LoadingText role="status">책장을 여는 중이에요</LoadingText>
          <ShelfGrid aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i}>
                <GhostCover />
                <GhostLine />
              </div>
            ))}
          </ShelfGrid>
        </>
      ) : loadError ? (
        <LoadError
          title="책장을 불러오지 못했어요."
          description={
            <>
              <Nowrap>저장된 동화는 그대로 있어요.</Nowrap> <Nowrap>잠시 뒤 다시 시도해 주세요.</Nowrap>
            </>
          }
          actionText="다시 시도"
          onAction={fetchData}
        />
      ) : characterList.length > 0 ? (
        <>
          <Filters role="group" aria-label="주인공으로 거르기">
            <Chip selected={selectedCharacterId === null} onClick={selectAll}>
              전체
            </Chip>
            {characterList.map((char) => (
              <Chip
                key={char.charId}
                selected={selectedCharacterId === char.charId}
                image={char.charImg || coverPlaceholder}
                onClick={() => {
                  setSelectedCharacterId(char.charId);
                  setSelectedCharacterName(char.charName);
                }}
              >
                {char.charName}
              </Chip>
            ))}
          </Filters>

          {selectedCharacterId !== null && filteredStoryList.length > 0 && (
            <SectionTitle>
              <Accent>{selectedCharacterName}</Accent>(이)가 나오는 동화들
            </SectionTitle>
          )}

          {filteredStoryList.length > 0 ? (
            <ShelfGrid>
              {filteredStoryList.map((story) => (
                <Block
                  key={story.storyId}
                  blockImg={story.coverImg}
                  blockName={story.title || UNTITLED}
                  creationDate={formatDate(story.creationDate)}
                  storyId={story.storyId}
                  showFavorite={true}
                  onClick={() => handleBlockClick(story)}
                />
              ))}
            </ShelfGrid>
          ) : (
            <Empty
              title="선택한 캐릭터의 동화가 없어요."
              description="다른 캐릭터를 선택해보세요!"
              buttonText="전체 보기"
              onButtonClick={selectAll}
            />
          )}
        </>
      ) : (
        <Empty
          title="등록된 캐릭터가 없습니다."
          description="캐릭터를 등록해주세요!"
          buttonText="캐릭터 등록"
          onButtonClick={() => navigate('/create-character')}
        />
      )}

      {/* 책 열기: 즐겨찾기 화면과 같은 대화상자(표지 → 제목 → 날짜·줄거리 → 열기·닫기) */}
      {selectedStory && (
        <Dialog
          open
          onClose={handleClosePopup}
          title={selectedTitle}
          media={<CoverPlate src={selectedStory.coverImg} />}
          actions={
            <>
              <RoundedButton
                type="button"
                $primary
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
            </>
          }
        >
          {(selectedDate || selectedStory.summary) && (
            <>
              {selectedDate && <DialogDate>{selectedDate}</DialogDate>}
              {selectedStory.summary && <p>{selectedStory.summary}</p>}
            </>
          )}
        </Dialog>
      )}
    </PageShell>
  );
}
