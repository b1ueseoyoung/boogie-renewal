import React from 'react';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { authUserState } from '../recoil/atoms';
import { logoutUser } from '../api/auth';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
`;

const Block = styled.div`
  background-color: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 10px;
  color: ${({ theme }) => theme.colors.ink};
  cursor: ${props => (props.clickable ? 'pointer' : 'default')};
`;

const BlockTitle = styled.h3`
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
`;

const BlockItem = styled.div`
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
`;

// 회원탈퇴: 위험한 동작이라 빨간펜으로 채운다(원본 값은 흰 바탕 대비 3.27:1이라 4.5:1을 넘는 redpen 5.53:1을 쓴다)
const DangerButton = styled(RoundedButton)`
  background: ${({ theme }) => theme.colors.redpen};
  border-color: ${({ theme }) => theme.colors.redpen};
  color: ${({ theme }) => theme.colors.surface};

  &:hover {
    background: ${({ theme }) => theme.colors.redpen};
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1.5rem;
`;

export default function SettingScreen() {
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useRecoilState(authUserState);

  // 서버 로그아웃이 실패해도 브라우저 쪽 상태는 비우고 로그인 화면으로 보낸다
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('로그아웃 요청 실패:', err);
    }
    setAuthUser(null);
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = () => {
    console.log('회원탈퇴');
  };

  return (
    <BaseScreenLayout
      title="설정"
      subTitle="계정 정보를 확인하세요."
    >
      <Container>
        {/* 로그인 정보 */}
        <Block>
          <BlockTitle>로그인 정보</BlockTitle>
          <BlockItem>이름: {authUser?.userName}</BlockItem>
          <BlockItem>아이디: {authUser?.userId}</BlockItem>
        </Block>

        {/* 로그아웃 / 회원탈퇴 */}
        <ButtonContainer>
          <RoundedButton onClick={handleLogout}>로그아웃</RoundedButton>
          <DangerButton
            onClick={handleDeleteAccount}
          >
            회원탈퇴
          </DangerButton>
        </ButtonContainer>
      </Container>
    </BaseScreenLayout>
  );
}
