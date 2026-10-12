import React, { useState, useEffect } from 'react';
import PageShell, { PageHeader, ShelfGrid } from '../components/PageShell';
import Block from '../components/Block';
import Dialog from '../components/Dialog';
import Empty from '../components/Empty';
import RoundedButton from '../components/RoundedButton';
import { CoverPlate } from '../components/Placeholder';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

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
    <PageShell>
      {/* 제목은 캐릭터가 없어도 늘 보인다 */}
      <PageHeader title="내 캐릭터" />

      {characterList.length > 0 ? (
        <ShelfGrid>
          {characterList.map((char) => (
            <Block
              key={char.charId}
              blockImg={char.charImg}
              blockName={char.charName}
              onClick={() => handleBlockClick(char)}
              hideDate={true}
              hideFavorite={true}
            />
          ))}
        </ShelfGrid>
      ) : (
        <Empty
          title="보유하고 있는 내 캐릭터가 없어요..."
          description="이야기를 생성하면 캐릭터가 추가될 거예요. 우리 새 이야기를 만들러 갈까요?"
          buttonText="이야기 만들러 가기"
          onButtonClick={() => navigate("/character-select")}
        />
      )}

      {selectedCharacter && (
        <Dialog
          open
          onClose={handleClosePopup}
          title={selectedCharacter.charName}
          label="내 캐릭터"
          // 캐릭터 그림: 책 표지와 같은 판. 판 폭은 대화상자 폭을 넘지 않는다
          media={<CoverPlate src={selectedCharacter.charImg} maxWidth="13rem" />}
          actions={
            <RoundedButton type="button" $primary onClick={handleClosePopup}>
              닫기
            </RoundedButton>
          }
        />
      )}
    </PageShell>
  );
}
