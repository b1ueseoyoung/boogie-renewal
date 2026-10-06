import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import Block from '../components/Block';
import Empty from '../components/Empty';
import styled from 'styled-components';
import PopCard from '../components/PopCard';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import defaultImg from '../assets/images/testImg.png';

const CharacterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.surface};
  min-height: 100vh;
  height: 300vh;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 0.875rem 1rem 1.5rem 0.875rem;
  gap: 1rem;
  width: 100%;

  @media (max-width: 360px) {
    gap: 0.75rem;
    padding: 0.5rem;
  }

  @media (min-width: 361px) and (max-width: 719px) {
    gap: 0.875rem;
    padding: 0.75rem;
  }

  @media (min-width: 720px) and (max-width: 1079px) {
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  @media (min-width: 1080px) and (max-width: 1439px) {
    gap: 1rem;
    padding: 1rem 1.25rem;
  }

  @media (min-width: 1440px) {
    gap: 1.25rem;
    padding: 1.5rem 2rem;
  }
`;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(28, 28, 28, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

export default function CharacterStore() {
  const [characterList, setCharacterList] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/mypage/character`);
        setCharacterList(res.data); 
      } catch (error) {
        console.error('캐릭터 불러오기 실패:', error);
      }
    };

    fetchCharacters();
  }, []);

  const handleBlockClick = (character) => {
    setSelectedCharacter(character);
  };

  const handleClosePopup = () => {
    setSelectedCharacter(null);
  };

  return (
    <CharacterContainer>
      {characterList.length > 0 && <Header pageName={"내 캐릭터"} />}
      <ContentContainer>
        {characterList.length > 0 ? (
          characterList.map((char) => (
            <Block
              key={char.charId}
              blockImg={char.charImg || defaultImg}
              blockName={char.charName}
              onClick={() => handleBlockClick(char)}
              hideDate={true}
              hideFavorite={true}
              customSize={true}
              withShadow={true}
            />
          ))
        ) : (
          <Empty
            title="보유하고 있는 내 캐릭터가 없어요..."
            description="이야기를 생성하면 캐릭터가 추가될 거예요. 우리 새 이야기를 만들러 갈까요?"
            buttonText="이야기 만들러 가기"
            onButtonClick={() => navigate("/character-select")}
          />
        )}
      </ContentContainer>

      {selectedCharacter && (
        <Overlay onClick={handleClosePopup}>
          <PopCard
            imageSrc={selectedCharacter.charImg || defaultImg}
            imageSize="13rem"
            cardTitle={selectedCharacter.charName}
            positiveBtnText="닫기"
            onPositiveClick={handleClosePopup}
          />
        </Overlay>
      )}

      <BottomNav />
    </CharacterContainer>
  );
}