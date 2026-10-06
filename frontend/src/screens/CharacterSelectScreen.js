import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import dokkaebiImg from '../assets/images/mainCharactor.png';

const Notice = styled.p`
  margin-bottom: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => `${theme.space[3]} ${theme.space[4]}`};
  font-size: ${({ theme }) => theme.text.base};
  color: ${({ theme }) => theme.colors.ink};
  background: ${({ theme }) => theme.colors.accentPale};
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.card};
`;

const CharacterSelectScreen = () => {
  const navigate = useNavigate();
  // 흐름 화면이 새로고침으로 상태를 잃고 이리로 보냈을 때
  const flowLost = useLocation().state?.flowLost;

  const handleUseExisting = () => {
    navigate('/select-existing-character');
  };

  const handleUseNew = () => {
    navigate('/create-character');
  };

  return (
    <BaseScreenLayout
      progressText="1/3"
      progressCurrent={1}
      progressTotal={3}
      title={"이야기에는\n주인공이 필요해요!"}
      subTitle="기존 캐릭터를 사용하거나, 새 캐릭터를 만들어 보세요."
      imageSrc={dokkaebiImg}
      imageAlt="도깨비"
    >
      <div>
        {flowLost && (
          <Notice role="status" data-qa="flow-notice">
            새로고침해서 만들던 내용을 이어 갈 수 없어요. 주인공을 다시 골라 주세요.
          </Notice>
        )}
        <RoundedButton $primary type="button" onClick={handleUseNew}>
          새 캐릭터를 사용하기
        </RoundedButton>

        <RoundedButton type="button" onClick={handleUseExisting}>
          기존 캐릭터를 사용하기
        </RoundedButton>
      </div>
    </BaseScreenLayout>
  );
};

export default CharacterSelectScreen;
