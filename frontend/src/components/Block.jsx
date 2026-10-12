import styled, { css } from 'styled-components';
import FavoriteButton from './FavoriteButton';
import { CoverImg } from './Placeholder';

// 책·캐릭터 카드: 3:4 표지(가는 테두리, 그림자 없음) → 제목(두 줄까지) → 날짜.
// onClick이 있으면 표지와 글자가 한 버튼이 되어 키보드(Enter·Space)로도 연다. 즐겨찾기 별은 그 버튼 밖, 표지 위에 겹쳐 둔다.
// 격자(ShelfGrid) 안에서는 칸을 채우고, 줄바꿈 flex 안에서는 한 칸 폭(10.5rem 안팎)을 가진다.

// 표지: 둥근 모서리와 가는 테두리(그림자 없음). 그림이 없으면 대체 그림(CoverImg)
const Cover = styled.span`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  margin-bottom: ${({ theme }) => theme.space[2]};
  overflow: hidden;
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface2};
  box-shadow: ${({ theme }) => theme.shadow.art};
  transition-property: border-color, box-shadow;
  transition-duration: ${({ theme }) => theme.motion.base};
  transition-timing-function: ${({ theme }) => theme.motion.ease};

  & > img {
    transition: filter ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};
  }
`;

const BlockContainer = styled.div`
  position: relative;
  flex: 0 1 min(10.5rem, 42vw);
  min-width: 0;

  /* 올리면 뜨지 않고 표지 테두리가 조금 진해지며 그림이 살짝 밝아진다 */
  ${({ $clickable, theme }) =>
    $clickable &&
    css`
      @media ${theme.mq.hover} {
        &:hover ${Cover} {
          border-color: ${theme.colors.lineStrong};
          box-shadow: ${theme.shadow.cardHover};
        }

        &:hover ${Cover} > img {
          filter: brightness(1.04);
        }
      }
    `}
`;

// 표지와 글자를 묶는 자리. 누를 수 있으면 button, 아니면 div
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  width: 100%;
  padding: 0;
  border: none;
  border-radius: ${({ theme }) => theme.radius.art};
  background: none;
  color: inherit;
  font: inherit;
  text-align: center;
  cursor: ${({ $button }) => ($button ? 'pointer' : 'default')};

  /* 누르면 전역 버튼 규칙대로 표지와 글자가 함께 살짝 작아진다 */
  &:focus-visible {
    outline-offset: 0.25rem;
  }
`;

const IMG = styled(CoverImg)`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
`;

// 긴 제목은 두 줄에서 자르고 전체 제목은 title 속성으로 보인다
const Title = styled.span`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  padding-inline: ${({ theme }) => theme.space[1]};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  letter-spacing: ${({ theme }) => theme.tracking.body};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
`;

// 날짜: 카드가 회백 바탕(bg) 위에 놓여 inkMuted(4.27:1)는 13px 글자에 모자라서 inkSoft(6.6:1)를 쓴다
const Date = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.text.caption};
  line-height: 1.4;
  color: ${({ theme }) => theme.colors.inkSoft};
  white-space: nowrap;
`;

export default function Block({
  blockImg,
  blockName,
  creationDate,
  storyId,
  isEditing = false,
  showFavorite = true,
  hideDate = false,
  hideFavorite = false,
  onClick,
}) {
  const clickable = Boolean(onClick);
  return (
    <BlockContainer $clickable={clickable}>
      <Body as={clickable ? 'button' : 'div'} $button={clickable} type={clickable ? 'button' : undefined} onClick={onClick}>
        <Cover>
          <IMG src={blockImg} alt="" />
        </Cover>
        <Title title={blockName || undefined}>{blockName}</Title>
        {!hideDate && creationDate && <Date>{creationDate}</Date>}
      </Body>
      {!hideFavorite && showFavorite && storyId && !isEditing && (
        <FavoriteButton storyId={storyId} title={blockName} />
      )}
    </BlockContainer>
  );
}
