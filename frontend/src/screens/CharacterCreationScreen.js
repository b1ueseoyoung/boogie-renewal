import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { useRecoilState } from 'recoil';
import { characterInfoState } from '../recoil/atoms';
import { useNavigate } from 'react-router-dom';
import BaseScreenLayout from '../components/BaseScreenLayout';
import { NoteBox } from '../components/Card';
import GallerySelectButton from '../components/GallerySelectButton';
import GenerationError from '../components/GenerationError';
import WaitingOverlay from '../components/WaitingOverlay';
import { uploadPhoto } from '../api/files';

// 사진 안내 상자: 공통 NoteBox(옅은 파랑, 테두리 없음, 방패 아이콘은 accentDeep). 캐릭터 고르기 화면의 안내와 같은 모양
const Consent = styled(NoteBox)`
  font-size: ${({ theme }) => theme.text.sm};
`;

const ShieldIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const CharacterCreationScreen = () => {
  const navigate = useNavigate();
  const [, setCharacterInfo] = useRecoilState(characterInfoState);
  const [isFinished, setIsFinished] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const busyRef = useRef(false);

  const handleSelectImage = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleRetry = () => {
    setUploadError(null);
    handleSelectImage();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || busyRef.current) return;

    busyRef.current = true;
    setUploadError(null);
    setIsUploading(true);
    try {
      const photoUrl = await uploadPhoto(file);

      setCharacterInfo((prev) => {
        const first = prev[0] || {};
        const updated = { ...first, userImg: photoUrl };
        return [updated, ...prev.slice(1)];
      });
      setIsUploading(false);
      setIsFinished(true);
      setTimeout(() => {
        navigate('/character-question');
      }, 1500);
    } catch (error) {
      busyRef.current = false;
      setIsUploading(false);
      setUploadError(error);
    }
  };

  return (
    <BaseScreenLayout
      progressCurrent={1}
      progressTotal={3}
      title={`주인공은 어떻게\n생겼나요?`}
      subTitle="주인공이 될 인물의 사진을 업로드해 주세요."
      aside={<GallerySelectButton onClick={handleSelectImage} isFinished={isFinished} />}
    >
      <Consent $icon>
        <ShieldIcon />
        <p>사진은 그림을 만들기 위해 OpenAI로 전송돼요. 본인이나 보호자가 동의한 사진만 올려 주세요.</p>
      </Consent>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        hidden
        onChange={handleFileChange}
      />

      {isUploading && <WaitingOverlay message="사진을 올리고 있어요" />}

      {uploadError && (
        <GenerationError error={uploadError} onRetry={handleRetry} onClose={() => setUploadError(null)} />
      )}
    </BaseScreenLayout>
  );
};

export default CharacterCreationScreen;
