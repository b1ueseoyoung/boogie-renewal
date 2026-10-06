import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { userInfoState } from '../recoil/atoms';
import { loginUser } from '../api/auth';

const LoginContainer = styled.div`
  width: 100%;
  height: 100vh;
  background-color: ${({ theme }) => theme.legacy.night};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6.25rem 2rem 16.875rem 2rem;
`;

const FrameWrapper = styled.div`
  max-width: 25.75rem;
`;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 6rem;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.legacy.paper};
  font-family: Pretendard;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.06rem;
`;

const SubTitle = styled.p`
  color: ${({ theme }) => theme.legacy.paper};
  font-family: Pretendard;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: -0.03rem;
`;

const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
`;

const CredentialWrapper = styled.div`
  width: 19.875rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  color: ${({ theme }) => theme.legacy.paper};
  font-family: Pretendard;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 2.1875rem;
  letter-spacing: -0.03rem;
`;

const Input = styled.input`
  padding: 1rem;
  width: 100%;
  border: 1px solid rgba(253, 252, 250, 0.50);
  background: rgba(253, 252, 250, 0.20);
  color: ${({ theme }) => theme.colors.surface};
  &::placeholder {
    color: ${({ theme }) => theme.colors.rule};
  }
`;

const LoginButton = styled.button`
  width: 9.125rem;
  padding: 0.5rem 2rem;
  border-radius: 6.25rem;
  background: ${({ theme }) => theme.legacy.gold};
  color: ${({ theme }) => theme.legacy.goldInk};
  font-family: Pretendard;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { opacity: 0.9; }
`;

const BottomText = styled.div`
  color: ${({ theme }) => theme.legacy.paper};
  font-family: Pretendard;
  font-size: 1rem;
  margin-top: 1rem;
`;

const LinkText = styled.span`
  color: ${({ theme }) => theme.legacy.gold};
  cursor: pointer;
  margin-left: 0.25rem;
  text-decoration: underline;
`;

export default function LoginScreen() {
  const navigate = useNavigate();
  const [, setUserInfo] = useRecoilState(userInfoState);
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!userID || !password) {
      alert('아이디와 비밀번호를 입력해주세요.');
      return;
    }
    try {
      const { data } = await loginUser({ userID, password });
      if (data.success) {
        // Recoil 및 localStorage에 토큰·유저 정보 저장
        setUserInfo([{
          id: data.user.id,
          nickname: data.user.nickname,
          pNumber: data.user.pNumber,
          password: ''
        }]);
        localStorage.setItem('jwt', data.token);
        navigate('/');
      } else {
        alert('로그인 정보가 올바르지 않습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <LoginContainer>
      <FrameWrapper>
        <TitleWrapper>
          <Title>꿈도깨비</Title>
          <SubTitle>나만의 이야기를 만들어봐요!</SubTitle>
        </TitleWrapper>
        <FormWrapper>
          <CredentialWrapper>
            <FieldWrapper>
              <Label htmlFor="userID">아이디</Label>
              <Input
                id="userID"
                type="text"
                placeholder="아이디"
                value={userID}
                onChange={e => setUserID(e.target.value)}
              />
            </FieldWrapper>
            <FieldWrapper>
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </FieldWrapper>
          </CredentialWrapper>
          <LoginButton onClick={handleLogin}>로그인</LoginButton>
          <BottomText>
            아직 계정이 없다면?
            <LinkText onClick={() => navigate('/signup')}>회원가입</LinkText>
          </BottomText>
        </FormWrapper>
      </FrameWrapper>
    </LoginContainer>
  );
}