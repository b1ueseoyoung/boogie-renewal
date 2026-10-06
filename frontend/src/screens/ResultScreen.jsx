import React from 'react';
import { useTheme } from 'styled-components';
import { useRecoilValue } from 'recoil';
import { storyInfoState } from '../recoil/atoms';
import { useNavigate } from 'react-router-dom';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';

const ResultScreen = () => {
  const theme = useTheme();
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
      progressText=""
      title="짜잔 이야기가 완성됐어요!"
      subTitle="만들어진 이야기는 내 책장에 저장될 거에요."
      imageSrc={firstImage}
      imageAlt="썸네일"
    >

      <div style={{ color: theme.colors.ink, marginBottom: '20px' }}>
        [{storyInfo.title || '이야기제목10자이내?'}]
      </div>

      {/* 버튼 2개 (RoundedButton 재사용) */}
      <RoundedButton onClick={handleReadNow}>
        바로 읽어보기
      </RoundedButton>

      <RoundedButton onClick={handleGoToStorage}>
        내 책장으로 가기
      </RoundedButton>
    </BaseScreenLayout>
  );
};

export default ResultScreen;