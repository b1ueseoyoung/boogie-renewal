import React, { useState } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import Block from '../components/Block';
import Dialog from '../components/Dialog';
import RoundedButton from '../components/RoundedButton';
import PageShell, { PageHeader, ShelfGrid } from '../components/PageShell';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { WarnBadge } from '../components/Notice';
import { PickCheck, pickedRing } from '../components/Pick';
import { UNTITLED } from '../components/Placeholder';

// 책을 고르는 칸: 카드 전체를 덮는 투명한 체크박스 하나가 누르기·키보드(Space)를 맡고,
// 표지 위에는 고른 상태를 보여 주는 고리와 오른쪽 위 원(공통 PickCheck: 고르면 파란 원 안 흰 체크, 아니면 빈 원)을 겹친다.
const Pick = styled.div`
  position: relative;
`;

// Block 표지(폭 100%, 3:4)와 같은 자리를 덮는다
const Ring = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  aspect-ratio: 3 / 4;
  border-radius: ${({ theme }) => theme.radius.art};
  pointer-events: none;
  transition: box-shadow ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
`;

// 체크박스 상태(~ 선택자)로 hover 모양을 바꾸려고 styled로 감싼다
const Mark = styled(PickCheck)``;

const Toggle = styled.input.attrs({ type: 'checkbox' })`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  opacity: 0;
  cursor: pointer;

  &:checked ~ ${Ring} {
    box-shadow: ${({ theme }) => pickedRing(theme)};
  }

  /* 체크박스는 보이지 않으므로 포커스 고리는 표지 바깥에 그린다(고른 고리와 떨어지게) */
  &:focus-visible ~ ${Ring} {
    outline: 0.1875rem solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0.375rem;
  }

  /* 올리면 책장의 표지처럼 테두리가 조금 진해지고 옅은 그림자가 생긴다(뜨지 않는다) */
  @media ${({ theme }) => theme.mq.hover} {
    &:hover:not(:checked) ~ ${Ring} {
      box-shadow: inset 0 0 0 1px ${({ theme }) => theme.colors.lineStrong}, ${({ theme }) => theme.shadow.cardHover};
    }

    &:hover:not(:checked) ~ ${Mark} {
      box-shadow: inset 0 0 0 0.125rem ${({ theme }) => theme.colors.accent}, 0 0 0 0.125rem ${({ theme }) => theme.colors.surface};
    }
  }
`;

export default function EditBookshelf() {
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

  const pickedCount = selectedIds.length;

  return (
    <PageShell $nav={false}>
      <PageHeader
        title="내 책장 편집하기"
        subTitle={<span role="status">{pickedCount > 0 ? `${pickedCount}권 골랐어요` : '지울 동화를 골라 주세요'}</span>}
        actions={
          <RoundedButton
            type="button"
            $danger
            $size="sm"
            $inline
            onClick={() => setShowPopup(true)}
          >
            삭제하기
          </RoundedButton>
        }
      />

      <ShelfGrid>
        {storyList.map((story) => {
          const picked = selectedIds.includes(story.storyId);
          return (
            <Pick key={story.storyId}>
              {/* 제목은 체크박스 이름으로 읽히므로 카드 글자는 한 번만 읽히게 숨긴다 */}
              <div aria-hidden="true">
                <Block
                  blockImg={story.img?.[0] || story.cover?.testImg}
                  blockName={story.title || UNTITLED}
                  creationDate={story.date}
                  storyId={story.storyId}
                  hideDate={true}
                  hideFavorite={true}
                  isEditing={false}
                />
              </div>
              <Toggle
                checked={picked}
                onChange={() => toggleSelect(story.storyId)}
                aria-label={story.title || UNTITLED}
              />
              <Ring />
              <Mark picked={picked} />
            </Pick>
          );
        })}
      </ShelfGrid>

      <Dialog
        open={showPopup}
        onClose={() => setShowPopup(false)}
        closeOnScrim={false}
        title={`총 ${selectedIds.length}개의 동화를 삭제할까요?`}
        media={<WarnBadge />}
        actions={
          <>
            <RoundedButton type="button" $danger onClick={handleDeleteConfirm}>
              네! 삭제할래요.
            </RoundedButton>
            {/* 지우는 쪽에 포커스가 먼저 가지 않게 한다 */}
            <RoundedButton type="button" autoFocus onClick={() => setShowPopup(false)}>
              아니요!
            </RoundedButton>
          </>
        }
      >
        <p>한 번 삭제되면 복구할 수 없어요.</p>
      </Dialog>
    </PageShell>
  );
}
