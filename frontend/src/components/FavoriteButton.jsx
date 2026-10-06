import React from 'react';
import { useRecoilState } from 'recoil';
import { favoriteStoryIdsState } from '../recoil/atoms';
import { BsStar, BsStarFill } from 'react-icons/bs';
import styled, { useTheme } from 'styled-components';

const Button = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  padding: 0.25rem;
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.rule};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

export default function FavoriteButton({ storyId }) {
  const theme = useTheme();
  const [favoriteIds, setFavoriteIds] = useRecoilState(favoriteStoryIdsState);
  const isFavorite = favoriteIds.includes(storyId);

  const handleClick = (e) => {
    e.stopPropagation(); // 카드 클릭 방지
    setFavoriteIds((prev) =>
      isFavorite ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  return (
    <Button onClick={handleClick}>
      {isFavorite ? <BsStarFill color={theme.colors.accent} size={16} /> : <BsStar color={theme.colors.inkSoft} size={16} />}
    </Button>
  );
}
