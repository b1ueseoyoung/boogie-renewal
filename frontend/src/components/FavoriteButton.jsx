import React from 'react';
import { useRecoilState } from 'recoil';
import { favoriteStoryIdsState } from '../recoil/atoms';
import { BsStar, BsStarFill } from 'react-icons/bs';
import styled from 'styled-components';

// 표지 오른쪽 위의 즐겨찾기 별. 보이는 원은 2.25rem이고, 누르는 자리는 ::before로 theme.tap(44px)까지 넓힌다.
// 켜지면 해 색(sunPale 바탕 + sun 테두리 + sunDeep 채운 별, 3.38:1), 꺼지면 흰 원 + 가는 테두리 + inkMuted 빈 별(4.62:1)
const Button = styled.button`
  position: absolute;
  top: ${({ theme }) => theme.space[2]};
  right: ${({ theme }) => theme.space[2]};
  z-index: 2;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: ${({ theme, $on }) => ($on ? theme.colors.sunPale : theme.colors.surface)};
  color: ${({ theme, $on }) => ($on ? theme.colors.sunDeep : theme.colors.inkMuted)};
  /* 가는 테두리는 안쪽 선으로 그린다(border를 두면 ::before의 누르는 자리가 44px보다 작아진다) */
  box-shadow: inset 0 0 0 1px ${({ theme, $on }) => ($on ? theme.colors.sun : theme.colors.line)};
  cursor: pointer;

  @media ${({ theme }) => theme.mq.hover} {
    &:hover {
      background: ${({ theme, $on }) => ($on ? theme.colors.sunPale : theme.colors.surface2)};
      color: ${({ theme, $on }) => ($on ? theme.colors.sunDeep : theme.colors.inkSoft)};
    }
  }

  &::before {
    content: '';
    position: absolute;
    inset: calc((2.25rem - ${({ theme }) => theme.tap}) / 2);
    border-radius: 50%;
  }

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }
`;

// title: 어느 책의 별인지 화면 읽기에 알린다("숲속 모험 즐겨찾기")
export default function FavoriteButton({ storyId, title }) {
  const [favoriteIds, setFavoriteIds] = useRecoilState(favoriteStoryIdsState);
  const isFavorite = favoriteIds.includes(storyId);

  const handleClick = (e) => {
    e.stopPropagation(); // 카드 클릭 방지
    setFavoriteIds((prev) =>
      isFavorite ? prev.filter(id => id !== storyId) : [...prev, storyId]
    );
  };

  return (
    <Button type="button" $on={isFavorite} aria-pressed={isFavorite} aria-label={title ? `${title} 즐겨찾기` : '즐겨찾기'} onClick={handleClick}>
      {isFavorite ? <BsStarFill aria-hidden="true" /> : <BsStar aria-hidden="true" />}
    </Button>
  );
}
