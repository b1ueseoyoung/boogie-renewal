import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Card from './Card';

// 캐릭터 정보 카드(흰 카드 + 가는 테두리). 누르면 캐릭터 만들기로 간다. 키보드로도 누를 수 있게 button으로 그린다
const CardContainer = styled(Card)`
  display: block;
  width: 100%;
  max-width: 25rem;
  margin: 0 auto;
  color: ${({ theme }) => theme.colors.ink};
  text-align: center;
  cursor: pointer;

  /* 올리면 테두리가 조금 진해지고 옅은 그림자가 생긴다(뜨지 않는다) */
  @media ${({ theme }) => theme.mq.hover} {
    &:hover {
      border-color: ${({ theme }) => theme.colors.lineStrong};
      box-shadow: ${({ theme }) => theme.shadow.cardHover};
    }
  }
`;

// button 안이라 제목·줄은 span(블록)으로 둔다
const CardTitle = styled.span`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[3]};
  padding-bottom: ${({ theme }) => theme.space[2]};
  border-bottom: ${({ theme }) => theme.border.rule};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.lg};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  letter-spacing: ${({ theme }) => theme.tracking.tight};
`;

const InfoLine = styled.span`
  display: block;
  font-size: ${({ theme }) => theme.text.sm};
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.inkSoft};
  white-space: pre-wrap;
  overflow-wrap: anywhere;

  & + & {
    margin-top: ${({ theme }) => theme.space[1]};
  }
`;

function CharacterCard({ name, age, gender, job, speciality, finalResponse }) {
  const navigate = useNavigate();

  // 카드 클릭 시 CharacterCreationScreen으로 이동 (예: 캐릭터 수정)
  const handleClick = () => {
    navigate('/create-character');
  };

  // finalResponse가 객체면 문자열로 변환해서 출력합니다.
  const displayResponse =
    finalResponse && typeof finalResponse === 'object'
      ? JSON.stringify(finalResponse, null, 2)
      : finalResponse;

  return (
    <CardContainer as="button" type="button" $pad="md" onClick={handleClick}>
      <CardTitle>캐릭터 카드</CardTitle>
      {finalResponse ? (
        <InfoLine>{displayResponse}</InfoLine>
      ) : (
        <>
          <InfoLine>이름: {name}</InfoLine>
          <InfoLine>나이: {age}</InfoLine>
          <InfoLine>성별: {gender}</InfoLine>
          <InfoLine>성격: {speciality}</InfoLine>
          <InfoLine>직업: {job}</InfoLine>
        </>
      )}
    </CardContainer>
  );
}

export default CharacterCard;
