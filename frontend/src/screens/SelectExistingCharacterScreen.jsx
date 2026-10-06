import React, { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { characterInfoState } from '../recoil/atoms';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import GenerationError from '../components/GenerationError';

const LOAD_ERROR = { errorClass: 'error', retryable: true };

const Grid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
  grid-template-columns: repeat(auto-fit, minmax(min(7.5rem, 45%), 11rem));
  margin-bottom: ${({ theme }) => theme.space[5]};

  /* auto-fit counts tracks by the 11rem maximum, which leaves one column on a phone; two columns there */
  @media (max-width: 30rem) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Card = styled.button`
  position: relative;
  padding: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.tap};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.inkSoft};
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.border.rule};
  border-radius: ${({ theme }) => theme.radius.card};
  cursor: pointer;
  transition: background-color ${({ theme }) => `${theme.motion.base} ${theme.motion.ease}`};

  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.colors.accentPale};
    color: ${({ theme }) => theme.colors.ink};
  }
`;

const CardArt = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  border-radius: ${({ theme }) => theme.radius.tag};
`;

const CardLabel = styled.span`
  display: block;
  margin-top: ${({ theme }) => theme.space[1]};
  text-align: center;
`;

const Check = styled.span`
  position: absolute;
  top: ${({ theme }) => theme.space[2]};
  right: ${({ theme }) => theme.space[2]};
  display: grid;
  place-items: center;
  width: 1.375rem;
  height: 1.375rem;
  border-radius: ${({ theme }) => theme.radius.tag};
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accentInk};
`;

const EmptyBox = styled.div`
  display: grid;
  place-items: center;
  gap: ${({ theme }) => theme.space[3]};
  padding: ${({ theme }) => `${theme.space[6]} ${theme.space[4]}`};
  background: ${({ theme }) => theme.colors.surface};
  border: 0.125rem dashed ${({ theme }) => theme.colors.pencil};
  border-radius: ${({ theme }) => theme.radius.card};
  text-align: center;
`;

const EmptyTitle = styled.p`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: 700;
`;

const EmptyText = styled.p`
  font-size: ${({ theme }) => theme.text.sm};
  color: ${({ theme }) => theme.colors.inkSoft};
`;

const CheckIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function SelectExistingCharacterScreen() {
  const [characterInfo, setCharacterInfo] = useRecoilState(characterInfoState);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchCharacters = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/mypage/character`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();

      setCharacterInfo(
        data.map((char) => ({
          charId: char.charId,
          name: char.charName,
          age: '',
          gender: '',
          job: '',
          speciality: '',
          note: char.charNote,
          img: char.charImg,
          userImg: char.userImg,
        }))
      );
      setLoaded(true);
    } catch (fetchError) {
      setError(LOAD_ERROR);
    }
  }, [setCharacterInfo]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const handleSelectCharacter = () => {
    const picked = characterInfo.find((c) => c.charId === selectedId);
    if (!picked) return;
    setCharacterInfo((prev) => [picked, ...prev.filter((c) => c.charId !== picked.charId)]);
    navigate('/confirm-character');
  };

  return (
    <BaseScreenLayout title="기존 캐릭터 선택" subTitle="주인공으로 쓸 캐릭터를 골라 주세요.">
      {loaded && characterInfo.length > 0 && (
        <>
          <Grid>
            {characterInfo.map((char) => (
              <Card
                key={char.charId}
                type="button"
                aria-pressed={char.charId === selectedId}
                onClick={() => setSelectedId(char.charId)}
              >
                {char.charId === selectedId && (
                  <Check>
                    <CheckIcon />
                  </Check>
                )}
                <CardArt src={char.img || '/default-character.png'} alt="" />
                <CardLabel>{char.name}</CardLabel>
              </Card>
            ))}
          </Grid>
          <RoundedButton $primary type="button" onClick={handleSelectCharacter} disabled={!selectedId}>
            선택하기
          </RoundedButton>
        </>
      )}

      {loaded && characterInfo.length === 0 && (
        <EmptyBox>
          <EmptyTitle>기존 캐릭터가 없어요...</EmptyTitle>
          <EmptyText>이야기를 생성하면 캐릭터가 추가돼요.</EmptyText>
          <RoundedButton $primary type="button" onClick={() => navigate('/character-select')}>
            새 이야기 만들기
          </RoundedButton>
        </EmptyBox>
      )}

      {error && <GenerationError error={error} onRetry={fetchCharacters} />}
    </BaseScreenLayout>
  );
}
