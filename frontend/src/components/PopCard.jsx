import styled, { useTheme } from "styled-components";
import { BsExclamationTriangleFill } from 'react-icons/bs';

const CardContainer = styled.div`
  display: flex;
  padding: 2rem;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.8rem;
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  font-family: ${({ theme }) => theme.fonts.body};
  width: 268px;
  height: 430px;

  @media (max-width: 360px) {
    width: 220px;
    height: 370px;
    padding: 1.25rem;
  }

  @media (min-width: 361px) and (max-width: 719px) {
    width: 240px;
    height: 400px;
    padding: 1.5rem;
  }

  @media (min-width: 720px) and (max-width: 1079px) {
    width: 260px;
    height: 420px;
  }

  @media (min-width: 1080px) and (max-width: 1439px) {
    width: 268px;
    height: 430px;
  }

  @media (min-width: 1440px) {
    width: 280px;
    height: 440px;
  }

  /* fitContent: 높이를 내용에 맞춘다. &&로 위의 화면 폭별 높이 규칙보다 우선한다 */
  ${({ $fitContent }) => $fitContent && '&& { height: auto; }'}
`;

const IMG = styled.img`
  margin-top: -1rem;
  width: ${(props) => props.imageWidth || '100%'};
  aspect-ratio: 2 / 3;
  /* 카드 높이가 고정이라 부제·설명·버튼이 들어갈 자리만큼 그림이 줄어든다(비율은 object-fit이 지킨다) */
  min-height: 0;
  object-fit: contain;
  border-radius: ${(props) => props.cornerRadius || '10px'};
  background-color: transparent;
`;

const Title = styled.div`
  color: ${({ color, theme }) => color || theme.colors.ink};
  font-family: ${({ theme }) => theme.fonts.display};
  text-align: center;
  font-size: ${(props) => props.fontSize || '1rem'};
  font-weight: 700;

  @media (max-width: 360px) {
    font-size: 0.85rem;
  }

  @media (min-width: 361px) and (max-width: 719px) {
    font-size: 0.9rem;
  }

  @media (min-width: 720px) and (max-width: 1079px) {
    font-size: 0.95rem;
  }

  /* fitContent 카드: 낱말 중간에서 줄을 바꾸지 않는다 */
  ${({ $fitContent }) => $fitContent && 'word-break: keep-all;'}
`;

/* 부제(날짜 등)와 설명(줄거리, 삭제 경고). 보조 글자라 inkSoft(흰 칸 대비 5.9:1), 크기는 theme.text 단계 */
const SubTitle = styled.div`
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 500;
  line-height: ${({ theme }) => theme.leading.tight};
  word-break: keep-all;
`;

const Description = styled.div`
  color: ${({ theme }) => theme.colors.inkSoft};
  text-align: center;
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 400;
  line-height: ${({ theme }) => theme.leading.tight};
  white-space: pre-line;
  word-break: keep-all;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: ${(props) => props.direction || 'row'};
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  align-self: stretch;
`;

const PositiveButton = styled.button`
  display: flex;
  padding: ${(props) => props.padding || '0.25rem 1rem'};
  justify-content: center;
  align-items: center;
  align-self: stretch;
  border-radius: ${({ theme }) => theme.radius.btn};
  border: none;
  /* $danger: 삭제처럼 되돌릴 수 없는 동작은 빨간펜 바탕에 흰 글자(5.53:1) */
  background: ${({ $danger, theme }) => ($danger ? theme.colors.redpen : theme.colors.accent)};
  color: ${({ $danger, theme }) => ($danger ? theme.colors.surface : theme.colors.accentInk)};
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;

  @media (max-width: 360px) {
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
  }
`;

const NegativeButton = styled.button`
  display: flex;
  padding: ${(props) => props.padding || '0.25rem 1rem'};
  justify-content: center;
  align-items: center;
  align-self: stretch;
  border-radius: ${({ theme }) => theme.radius.btn};
  border: ${({ theme }) => theme.border.thick};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.fonts.display};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;

  @media (max-width: 360px) {
    font-size: 0.75rem;
    padding: 0.25rem 0.75rem;
  }
`;

export default function PopCard({
  imageSrc,
  imageSize,
  cornerRadius,
  cardTitle,
  titleColor,
  subTitle,
  description,
  positiveBtnText,
  negativeBtnText,
  onPositiveClick,
  onNegativeClick,
  positivePadding,
  negativePadding,
  danger = false,
  useWarningIcon = false,
  fitContent = false,
}) {
  const theme = useTheme();
  return (
    <CardContainer $fitContent={fitContent}>
    {imageSrc ? (
     <IMG
     src={imageSrc}
     imageWidth={imageSize || '100%'}
     cornerRadius={cornerRadius || '0.625rem'}
     isCharacter={false}
   />
   
    ) : useWarningIcon ? (
      <BsExclamationTriangleFill size={50} color={theme.colors.redpen} />
    ) : null}
  
    <Title color={titleColor} $fitContent={fitContent}>{cardTitle}</Title>
    {subTitle && <SubTitle>{subTitle}</SubTitle>}
    {description && <Description>{description}</Description>}
    {/* fitContent 카드는 버튼이 없으면 버튼 줄을 그리지 않는다(빈 줄이 아래 여백을 늘린다) */}
    {(!fitContent || positiveBtnText || negativeBtnText) && (
    <ButtonContainer>
      {positiveBtnText && (
        <PositiveButton
          padding={positivePadding}
          $danger={danger}
          onClick={onPositiveClick}
        >
          {positiveBtnText}
        </PositiveButton>
      )}
      {negativeBtnText && (
        <NegativeButton
          padding={negativePadding}
          onClick={onNegativeClick}
        >
          {negativeBtnText}
        </NegativeButton>
      )}
    </ButtonContainer>
    )}
  </CardContainer>
  
  );
}
