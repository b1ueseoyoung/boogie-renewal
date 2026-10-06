import styled from "styled-components";
import imageSrc from "../assets/images/empty.png";

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 1rem;
  text-align: center;
  width: 100%;
  height: 90vh;
  min-height: 300px; // 높이 부족으로 줄어들 때 대비
`;


const Image = styled.img`
  width: 150px;
  height: 150px;
  object-fit: contain;
`;

const Title = styled.h2`
  color: ${({ theme }) => theme.colors.ink};
  text-align: center;
  font-size: 2.5rem;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  letter-spacing: -0.05rem;
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.ink};
  text-align: center;
  font-size: 1rem;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  letter-spacing: -0.02rem;
`;

const Button = styled.button`
  background-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accentInk};
  font-size: 1rem;
  font-weight: 600;
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  &:hover {
    background-color: ${({ theme }) => theme.colors.accentDeep};
  }
`;

export default function Empty({ title, description, buttonText, onButtonClick }) {
  return (
    <Container>
      <Title>{title}</Title>
      <Description>{description}</Description>
      {buttonText && <Button onClick={onButtonClick}>{buttonText}</Button>}
      <Image src={imageSrc} alt="empty-state" />
    </Container>
  );
}