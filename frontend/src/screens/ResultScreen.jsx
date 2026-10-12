import React from 'react';
import styled from 'styled-components';
import { useRecoilValue } from 'recoil';
import { storyInfoState } from '../recoil/atoms';
import { useNavigate } from 'react-router-dom';
import BaseScreenLayout, { SunDisc } from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import { UNTITLED } from '../components/Placeholder';
import finishImg from '../assets/images/finish.png';

// 첫 그림이 없을 때 그림 자리에 두는, 두 팔을 든 도깨비
const Cheer = styled(SunDisc)`
  width: clamp(8rem, 6rem + 6vw, 12rem);
  margin: 0 auto;
`;

// 완성된 책 이름
const BookTitle = styled.h2`
  font-size: ${({ theme }) => theme.text['2xl']};
  color: ${({ theme }) => theme.colors.ink};
  overflow-wrap: anywhere;
  text-wrap: balance;
`;

// 주요(바로 읽기) → 보조(책장) 버튼
const Actions = styled.div`
  margin-top: ${({ theme }) => theme.space[6]};
`;

const ResultScreen = () => {
  const navigate = useNavigate();
  const storyInfo = useRecoilValue(storyInfoState);
  const firstImage = storyInfo.img && storyInfo.img.length > 0
    ? storyInfo.img[0]
    : null;

  // "바로 읽어보기" 버튼 클릭
  const handleReadNow = () => {
    navigate('/reading');
  };

  // "내 책장으로 가기" 버튼 클릭
  const handleGoToStorage = () => {
    navigate('/bookshelf');
  };

  return (
    <BaseScreenLayout
      title="짜잔, 이야기가 완성됐어요!"
      subTitle="만들어진 이야기는 내 책장에 저장될 거예요."
      imageSrc={firstImage || undefined}
      imageAlt="완성된 동화의 첫 장면"
      aside={
        firstImage ? undefined : (
          <Cheer $fill="78%" aria-hidden="true">
            <img src={finishImg} alt="" />
          </Cheer>
        )
      }
    >
      <BookTitle>{storyInfo.title || UNTITLED}</BookTitle>

      <Actions>
        <RoundedButton type="button" $primary onClick={handleReadNow}>
          바로 읽어보기
        </RoundedButton>
        <RoundedButton type="button" onClick={handleGoToStorage}>
          내 책장으로 가기
        </RoundedButton>
      </Actions>
    </BaseScreenLayout>
  );
};

export default ResultScreen;
