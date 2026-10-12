import styled from 'styled-components';
import dokkaebiWhere from '../assets/images/dokkaebi_where.png';
import RoundedButton from './RoundedButton';
import { SunDisc } from './BaseScreenLayout';

// 빈 상태: 옅은 파랑 원 위에 고개를 갸웃하는 도깨비 → 제목 → 설명 → 할 일 버튼(있을 때만)
const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  min-height: 50vh;
  padding: ${({ theme }) => `${theme.space[7]} ${theme.space[4]}`};
  text-align: center;
`;

const Art = styled(SunDisc)`
  width: clamp(10rem, 8rem + 6vw, 12rem);
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.text['2xl']};
  color: ${({ theme }) => theme.colors.ink};
  text-wrap: balance;
`;

const Description = styled.p`
  max-width: 32ch;
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.inkSoft};
  text-wrap: balance;
`;

const Action = styled(RoundedButton)`
  &&& {
    margin-top: ${({ theme }) => theme.space[4]};
  }
`;

export default function Empty({ title, description, buttonText, onButtonClick }) {
  return (
    <Container>
      <Art aria-hidden="true">
        <img src={dokkaebiWhere} alt="" />
      </Art>
      {title && <Title>{title}</Title>}
      {description && <Description>{description}</Description>}
      {buttonText && (
        <Action type="button" $primary $inline onClick={onButtonClick}>
          {buttonText}
        </Action>
      )}
    </Container>
  );
}
