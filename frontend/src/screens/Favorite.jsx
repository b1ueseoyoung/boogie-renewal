import React, { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { storyInfoState, favoriteStoryIdsState } from '../recoil/atoms';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Block from '../components/Block';
import Empty from '../components/Empty';
import PopCard from '../components/PopCard';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import defaultImg from '../assets/images/testImg.png';

const FavoriteContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${({ theme }) => theme.colors.surface};
  min-height: 100vh;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 0.875rem 1rem 1.5rem 0.875rem;
  gap: 1rem;
  width: 100%;
`;

const StoryWrapper = styled.div`
  position: relative;
  flex: 1 1 calc(50% - 1rem);

  @media (min-width: 480px) {
    flex: 1 1 calc(33.33% - 1rem);
  }

  @media (min-width: 768px) {
    flex: 1 1 calc(25% - 1rem);
  }

  @media (min-width: 1024px) {
    flex: 1 1 calc(20% - 1rem);
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(28, 28, 28, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일`;
};

export default function Favorite() {
  const allStories = useRecoilValue(storyInfoState);
  const favoriteIds = useRecoilValue(favoriteStoryIdsState);
  const [selectedStory, setSelectedStory] = useState(null);
  const navigate = useNavigate();

  const favoriteStories = Array.isArray(allStories)
    ? allStories.filter(story => favoriteIds.includes(story.storyId))
    : [];

  const handleBlockClick = (story) => setSelectedStory(story);
  const handleClosePopup = () => setSelectedStory(null);

  return (
    <FavoriteContainer>
      {favoriteStories.length > 0 && <Header pageName="즐겨찾기" />}
      <ContentContainer>
        {favoriteStories.length > 0 ? (
          favoriteStories.map((story) => (
            <StoryWrapper key={story.storyId} onClick={() => handleBlockClick(story)}>
              <Block
                blockImg={story.coverImg || defaultImg}
                blockName={story.title}
                creationDate={formatDate(story.creationDate)}
                storyId={story.storyId}
                showFavorite={true}
              />
            </StoryWrapper>
          ))
        ) : (
          <Empty
            title="즐겨찾기한 동화가 없어요"
            description="마음에 드는 동화를 별표로 저장해보세요!"
            buttonText="책장으로 돌아가기"
            onButtonClick={() => navigate('/bookshelf')} 
          />
        )}
      </ContentContainer>

      {selectedStory && (
        <Overlay onClick={handleClosePopup}>
          <PopCard
            imageSrc={selectedStory.coverImg || defaultImg}
            cardTitle={selectedStory.title}
            subTitle={formatDate(selectedStory.creationDate)}
            description={selectedStory.summary}
            positiveBtnText="열기"
            negativeBtnText="닫기"
            onPositiveClick={() => {
              handleClosePopup();
              navigate(`/reading?file=${encodeURIComponent(selectedStory.content)}`);
            }}
            onNegativeClick={handleClosePopup}
            titleFontSize="1.1rem"
          />
        </Overlay>
      )}

      <BottomNav />
    </FavoriteContainer>
  );
}
