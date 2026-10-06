import styled from "styled-components";
import FavoriteButton from './FavoriteButton';
import { PaperFrame } from './BaseScreenLayout';

const BlockContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  width: 100%;
  min-width: 0;
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  border-radius: ${({ theme }) => theme.radius.card};
`;

const Frame = styled(PaperFrame)`
  max-width: 13rem;
  padding: ${({ theme }) => theme.space[2]};
`;

const ImageWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.tag};
`;

const IMG = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Title = styled.div`
  max-width: 13rem;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: 600;
  line-height: ${({ theme }) => theme.leading.tight};
  color: ${({ theme }) => theme.colors.ink};
  text-align: center;
  overflow-wrap: anywhere;
`;

const Date = styled.div`
  font-size: ${({ theme }) => theme.text.xs};
  color: ${({ theme }) => theme.colors.ink};
  text-align: center;
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
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };
  return (
    <BlockContainer
      $clickable={clickable}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
    >
      <Frame>
        <ImageWrapper>
          <IMG src={blockImg} alt={blockName || "story image"} />
          {!hideFavorite && showFavorite && storyId && !isEditing && (
            <FavoriteButton storyId={storyId} />
          )}
        </ImageWrapper>
      </Frame>
      <Title>{blockName}</Title>
      {!hideDate && creationDate && <Date>{creationDate}</Date>}
    </BlockContainer>
  );
}
