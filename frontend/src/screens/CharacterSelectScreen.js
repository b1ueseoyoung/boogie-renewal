import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import BaseScreenLayout, { SunDisc } from '../components/BaseScreenLayout';
import { NoteBox } from '../components/Card';
import RoundedButton from '../components/RoundedButton';
import dokkaebiImg from '../assets/images/mainCharactor.png';

// 옅은 파랑 원(SunDisc) 위의 도깨비. 좁은 화면에서는 작게 둬서 버튼까지 첫 화면에 들어오게 한다
const Art = styled(SunDisc)`
  width: min(60%, 12rem);
  margin: 0 auto;

  @media ${({ theme }) => theme.mq.wide} {
    width: min(100%, 20rem);
  }
`;

// 안내 상자: 공통 NoteBox(옅은 파랑, 테두리 없음). 사진 올리기 화면의 안내와 같은 모양
const Notice = styled(NoteBox)`
  margin-bottom: ${({ theme }) => theme.space[5]};
  font-size: ${({ theme }) => theme.text.base};
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

  // 새 캐릭터(사진 1/3 → 이름 2/3 → 확인 3/3)와 기존 캐릭터(고르기 2/3 → 확인 3/3)로 갈리는 자리라 진행 표시를 두지 않는다
  return (
    <BaseScreenLayout
      title={"이야기에는\n주인공이 필요해요!"}
      subTitle="기존 캐릭터를 사용하거나, 새 캐릭터를 만들어 보세요."
      aside={
        <Art>
          <img src={dokkaebiImg} alt="도깨비" />
        </Art>
      }
    >
      <div>
        {flowLost && (
          <Notice as="p" role="status" data-qa="flow-notice">
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
