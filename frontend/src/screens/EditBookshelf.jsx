import React, { useState } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import Block from '../components/Block';
import PopCard from '../components/PopCard';
import styled, { useTheme } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { BsCheckCircle, BsCheckCircleFill } from 'react-icons/bs';

const Container = styled.div`
  background-color: ${({ theme }) => theme.colors.surface};
  min-height: 100vh;
`;

const DeleteBar = styled.div`
  width: 100%;
  background-color: ${({ theme }) => theme.legacy.coral};
  text-align: center;
  padding: 0.75rem;
`;

const DeleteButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.ink};
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
`;

const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem;
  justify-content: flex-start;
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
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const IconWrapper = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  color: ${({ theme }) => theme.colors.surface};
  font-size: 1.25rem;
  z-index: 10;
`;

export default function EditBookshelf() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [storyList, setStoryList] = useState([]);

  useEffect(() => {
    const fetchStories = async () => {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/mypage/story`);
      setStoryList(res.data.stories);
    };
    fetchStories();
  }, []);
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteStories(selectedIds); // 서버에 삭제 요청
      const updatedList = storyList.filter(story => !selectedIds.includes(story.storyId));
      setStoryList(updatedList);
      setShowPopup(false);
      navigate('/bookshelf');
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  };
  
  const deleteStories = async (ids) => {
    try {
      await axios.delete(`${process.env.REACT_APP_API_BASE_URL}/mypage/story`, {
        data: { storyIds: ids }
      });
      console.log('✅ 삭제 요청 성공');
    } catch (error) {
      console.error('❌ 삭제 요청 실패:', error);
    }
  };
  
  return (
    <Container>
      <Header pageName="내 책장 편집하기" />

      <DeleteBar>
        <DeleteButton onClick={() => setShowPopup(true)}>삭제하기</DeleteButton>
      </DeleteBar>

      <Grid>
        {storyList.map((story) => (
          <StoryWrapper key={story.storyId} onClick={() => toggleSelect(story.storyId)}>
            <Block
              blockImg={story.img?.[0] || story.cover?.testImg}
              blockName={story.title}
              creationDate={story.date}
              storyId={story.storyId}
              hideDate={true}
              hideFavorite={true}
              isEditing={false}
            />
            <IconWrapper>
              {selectedIds.includes(story.storyId) ? <BsCheckCircleFill /> : <BsCheckCircle />}
            </IconWrapper>
          </StoryWrapper>
        ))}
      </Grid>

      {showPopup && (
        <Overlay>
          <PopCard
            useWarningIcon={true}
            buttonDirection="column"
            titleColor={theme.colors.redpen}
            cardTitle={`총 ${selectedIds.length}개의 동화를 삭제할까요?`}
            description="한 번 삭제되면 복구할 수 없어요."
            positiveBtnText="네! 삭제할래요."
            negativeBtnText="아니요!"
            onPositiveClick={handleDeleteConfirm}
            onNegativeClick={() => setShowPopup(false)}
            danger
            positivePadding="0.5rem 1rem"
            negativePadding="0.5rem 1rem"
                      />
        </Overlay>
      )}
    </Container>
  );
}