import React, { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { characterInfoState } from '../recoil/atoms';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import Empty from '../components/Empty';
import Skeleton from '../components/Skeleton';
import { LoadError } from '../components/Notice';
import { PickCheck, pickedRing } from '../components/Pick';
import { CoverImg } from '../components/Placeholder';

const LOAD_ERROR = { errorClass: 'error', retryable: true };
const SKELETONS = 4;

// 캐릭터 카드 격자: 휴대폰 2칸, 넓은 화면 3칸. 칸 폭은 카드(화면) 안쪽 폭에 맞춘다
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(9rem, 40%), 1fr));
  gap: ${({ theme }) => theme.space[4]};
  margin-bottom: ${({ theme }) => theme.space[6]};

  @media ${({ theme }) => theme.mq.phone} {
    gap: ${({ theme }) => theme.space[3]};
    margin-bottom: ${({ theme }) => theme.space[2]};
  }
`;

// 고르는 카드: 흰 카드 + 가는 테두리(그림자 없음), 이름은 15px semibold. 올리면 테두리가 조금 진해지고 옅은 그림자가 생긴다.
// 고르면 공통 선택 표시(옅은 파랑 바탕 + 파란 고리 + 체크 원), 글자는 accentDeep(7.1:1)
const Card = styled.button`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
  min-height: ${({ theme }) => theme.tap};
  padding: ${({ theme }) => theme.space[2]};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.card};
  color: ${({ theme }) => theme.colors.ink};
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: ${({ theme }) => theme.text.md};
  font-weight: ${({ theme }) => theme.weight.semibold};
  line-height: ${({ theme }) => theme.leading.tight};
  letter-spacing: ${({ theme }) => theme.tracking.body};
  text-align: center;
  cursor: pointer;

  @media ${({ theme }) => theme.mq.hover} {
    &:hover {
      border-color: ${({ theme }) => theme.colors.lineStrong};
      box-shadow: ${({ theme }) => theme.shadow.cardHover};
    }
  }

  /* 고르면 회색 테두리를 감추고 파란 고리만 보인다(후보 썸네일과 같다) */
  &[aria-pressed='true'] {
    border-color: transparent;
    background: ${({ theme }) => theme.colors.accentPale};
    box-shadow: ${({ theme }) => pickedRing(theme)};
    color: ${({ theme }) => theme.colors.accentDeep};
  }

  /* 포커스 고리는 고른 고리 바깥에 떨어뜨려 그린다 */
  &:focus-visible {
    outline-offset: 0.375rem;
  }
`;

// 휴대폰에서 캐릭터가 많아도 '선택하기'가 늘 보이도록 화면 아래에 붙인다. 위에 가는 선(크기는 그대로)을 둔다.
// 카드(BaseScreenLayout)의 휴대폰 좌우 여백(space[5])만큼 넓혀 카드 폭을 채운다
const ActionBar = styled.div`
  @media ${({ theme }) => theme.mq.phone} {
    position: sticky;
    bottom: 0;
    z-index: 1;
    margin-inline: calc(-1 * ${({ theme }) => theme.space[5]});
    padding: ${({ theme }) => `${theme.space[3]} ${theme.space[5]} calc(${theme.space[3]} + env(safe-area-inset-bottom))`};
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: ${({ theme }) => theme.shadow.lineTop};
  }
`;

// 그림이 없거나 못 불러오면 대체 그림(CoverImg)
const CardArt = styled(CoverImg)`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top;
  border-radius: ${({ theme }) => theme.radius.art};
  background: ${({ theme }) => theme.colors.surface2};
`;

const CardLabel = styled.span`
  display: block;
  padding: ${({ theme }) => `0 ${theme.space[1]} ${theme.space[1]}`};
  overflow-wrap: anywhere;
`;

// 고른 카드 오른쪽 위의 체크 원(공통 PickCheck). 카드 안쪽 여백만큼 더 들인다
const Check = styled(PickCheck)`
  top: ${({ theme }) => theme.space[3]};
  right: ${({ theme }) => theme.space[3]};
`;

// 불러오는 동안 카드 자리를 미리 보여 준다(공통 Skeleton). 테두리도 카드와 같게 둬서 바뀔 때 크기가 튀지 않는다
const SkeletonCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  border: ${({ theme }) => theme.border.card};
  border-radius: ${({ theme }) => theme.radius.card};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.card};
`;

const GhostArt = styled(Skeleton)`
  aspect-ratio: 3 / 4;
`;

const GhostName = styled(Skeleton)`
  width: 55%;
  height: 1.25em;
  margin: 0 auto ${({ theme }) => theme.space[1]};
`;

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
    <BaseScreenLayout
      maxWidth="44rem"
      progressCurrent={2}
      progressTotal={3}
      title="기존 캐릭터 선택"
      subTitle="주인공으로 쓸 캐릭터를 골라 주세요."
    >
      {!loaded && !error && (
        <Grid aria-hidden="true">
          {Array.from({ length: SKELETONS }, (_, i) => (
            <SkeletonCard key={i}>
              <GhostArt />
              <GhostName $round />
            </SkeletonCard>
          ))}
        </Grid>
      )}

      {/* 불러오기 실패: 책장·읽기 화면과 같은 화면 안 오류 카드(문구는 GenerationError의 'error'와 같다) */}
      {error && (
        <LoadError title="문제가 생겼어요." description="다시 시도해 주세요." actionText="다시 시도" onAction={fetchCharacters} />
      )}

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
                {char.charId === selectedId && <Check />}
                <CardArt src={char.img} alt="" />
                <CardLabel>{char.name}</CardLabel>
              </Card>
            ))}
          </Grid>
          <ActionBar>
            <RoundedButton $primary type="button" onClick={handleSelectCharacter} disabled={!selectedId}>
              선택하기
            </RoundedButton>
          </ActionBar>
        </>
      )}

      {loaded && characterInfo.length === 0 && (
        <Empty
          title="기존 캐릭터가 없어요..."
          description="이야기를 생성하면 캐릭터가 추가돼요."
          buttonText="새 이야기 만들기"
          onButtonClick={() => navigate('/character-select')}
        />
      )}

    </BaseScreenLayout>
  );
}
