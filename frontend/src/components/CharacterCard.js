import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const CardContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.ink};
  border: ${({ theme }) => theme.border.thick};
  border-radius: ${({ theme }) => theme.radius.card};
  padding: 20px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  cursor: pointer;
  text-align: center;
`;

const CardTitle = styled.h3`
  margin: 0;
  margin-bottom: 10px;
  font-size: 16px;
  border-bottom: ${({ theme }) => theme.border.rule};
  padding-bottom: 8px;
`;

const InfoLine = styled.p`
  margin: 4px 0;
  font-size: 14px;
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
    <CardContainer onClick={handleClick}>
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