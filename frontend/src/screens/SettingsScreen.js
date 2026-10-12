import React, { useState } from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { authUserState } from '../recoil/atoms';
import { logoutUser } from '../api/auth';
import PageShell, { PageHeader } from '../components/PageShell';
import Card from '../components/Card';
import RoundedButton from '../components/RoundedButton';
import { FormAlert } from '../components/FormField';

// 한 열짜리 짧은 화면: 제목과 같은 왼쪽 선에서 시작하고, 넓은 화면에서도 읽기 좋은 폭까지만 넓힌다
const Column = styled.div`
  width: 100%;
  max-width: 36rem;
`;

// 카드 제목: semibold (화면 제목 h1만 bold)
const CardTitle = styled.h2`
  font-size: ${({ theme }) => theme.text.xl};
  font-weight: ${({ theme }) => theme.weight.semibold};
  color: ${({ theme }) => theme.colors.ink};
`;

// 정보 목록: 라벨은 보조 글자(regular), 값은 본문 글자(medium)로 굵기를 나눈다. 행 사이는 가는 선
const InfoList = styled.dl`
  margin-top: ${({ theme }) => theme.space[3]};
`;

const InfoRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => `${theme.space[1]} ${theme.space[4]}`};
  padding: ${({ theme }) => `${theme.space[3]} 0`};

  & + & {
    border-top: ${({ theme }) => theme.border.rule};
  }

  dt {
    color: ${({ theme }) => theme.colors.inkSoft};
    font-size: ${({ theme }) => theme.text.base};
    font-weight: ${({ theme }) => theme.weight.regular};
  }

  dd {
    min-width: 0;
    color: ${({ theme }) => theme.colors.ink};
    font-size: ${({ theme }) => theme.text.lg};
    font-weight: ${({ theme }) => theme.weight.medium};
    overflow-wrap: anywhere;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[5]};
`;

export default function SettingScreen() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useRecoilState(authUserState);

  const [logoutError, setLogoutError] = useState('');

  // 서버 세션이 끝난 뒤에만 브라우저 상태를 비운다. 실패하면 이 화면에 남아 다시 누르게 한다
  const handleLogout = async () => {
    setLogoutError('');
    try {
      await logoutUser();
    } catch (err) {
      setLogoutError('로그아웃하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    setAuthUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <PageShell>
      <PageHeader title="설정" subTitle="계정 정보를 확인하세요." />
      <Column>
        <Card as="section" aria-labelledby="settings-account">
          <CardTitle id="settings-account">로그인 정보</CardTitle>
          <InfoList>
            <InfoRow>
              <dt>이름</dt>
              <dd>{authUser?.userName}</dd>
            </InfoRow>
            <InfoRow>
              <dt>아이디</dt>
              <dd>{authUser?.userId}</dd>
            </InfoRow>
          </InfoList>

          <Actions>
            {/* 오류 한 줄: 버튼 바로 위 */}
            <FormAlert>{logoutError}</FormAlert>
            <RoundedButton type="button" $inline onClick={handleLogout}>
              로그아웃
            </RoundedButton>
          </Actions>
        </Card>
      </Column>
    </PageShell>
  );
}
