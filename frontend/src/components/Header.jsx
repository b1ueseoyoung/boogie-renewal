import styled from 'styled-components';

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[4]};
  min-height: 3.5rem;
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[5]}`};
  background: ${({ theme }) => theme.colors.surface};
  border-bottom: ${({ theme }) => theme.border.thick};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.text.xl};
  color: ${({ theme }) => theme.colors.ink};
`;

export default function Header({ pageName }) {
  return (
    <HeaderContainer>
      <Title>{pageName}</Title>
    </HeaderContainer>
  );
}
