import React, { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { storyInfoState, favoriteStoryIdsState } from '../recoil/atoms';
import PageShell, { PageHeader, ShelfGrid } from '../components/PageShell';
import Block from '../components/Block';
import Dialog from '../components/Dialog';
import Empty from '../components/Empty';
import RoundedButton from '../components/RoundedButton';
import { CoverPlate, UNTITLED } from '../components/Placeholder';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

// 날짜: 흰 대화상자 위라 inkMuted(4.62:1). 줄거리(inkSoft)와 나뉘게 medium
const DialogDate = styled.p`
  color: ${({ theme }) => theme.colors.inkMuted};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: ${({ theme }) => theme.weight.medium};
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

  const selectedDate = selectedStory ? formatDate(selectedStory.creationDate) : '';

  return (
    <PageShell>
      {/* 제목은 즐겨찾기가 없어도 늘 보인다 */}
      <PageHeader title="즐겨찾기" />

      {favoriteStories.length > 0 ? (
        <ShelfGrid>
          {favoriteStories.map((story) => (
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
          title="즐겨찾기한 동화가 없어요"
          description="마음에 드는 동화를 별표로 저장해보세요!"
          buttonText="책장으로 돌아가기"
          onButtonClick={() => navigate('/bookshelf')}
        />
      )}

      {/* 책 열기: 책장 화면과 같은 대화상자(표지 → 제목 → 날짜·줄거리 → 열기·닫기) */}
      {selectedStory && (
        <Dialog
          open
          onClose={handleClosePopup}
          title={selectedStory.title || UNTITLED}
          media={<CoverPlate src={selectedStory.coverImg} />}
          actions={
            <>
              <RoundedButton
                type="button"
                $primary
                onClick={() => {
                  handleClosePopup();
                  navigate(`/reading?file=${encodeURIComponent(selectedStory.content)}`, {
                    state: { from: 'favorite' }, // 읽기 화면의 나가기 버튼이 '즐겨찾기로'(뒤로가기)가 된다
                  });
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
