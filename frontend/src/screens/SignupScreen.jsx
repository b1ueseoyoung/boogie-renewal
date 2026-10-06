import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { signupUser, checkUserId } from '../api/auth';

// min-height: 폼이 화면보다 길면 남색 바탕도 같이 늘어나야 한다(바탕이 밝은 노트로 바뀐 뒤 넘친 글자가 안 보였다)
const SignupContainer = styled.div`
  min-height: 100vh;
  background-color: ${({ theme }) => theme.legacy.night};
  display: flex;
  padding: 6.25rem 2rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const FrameWrapper = styled.div``;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const Title = styled.h1`
  color: ${({ theme }) => theme.legacy.paper};
  text-align: center;
  font-family: Pretendard;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: -0.06rem;
`;

const SubTitle = styled.p`
  color: ${({ theme }) => theme.legacy.paper};
  text-align: center;
  font-family: Pretendard;
  font-size: 1.5rem;
  font-weight: 400;
  letter-spacing: -0.03rem;
`;

const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 2.5rem;
`;

const FieldGroup = styled.div`
  display: flex;
  width: 19.875rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 2rem;
`;

const FieldWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-self: stretch;
`;

const Label = styled.label`
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  color: ${({ theme }) => theme.legacy.paper};
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

const SmallCheckButton = styled.button`
  padding: 0.25rem 1rem;
  border-radius: 6.25rem;
  border: 1px solid rgba(253, 252, 250, 0.50);
  background: rgba(253, 252, 250, 0.20);
  color: ${({ theme }) => theme.colors.surface};
  cursor: pointer;
  white-space: nowrap;
  &:hover { opacity: 0.9; }
`;

const SignupButton = styled.button`
  padding: 0.5rem 2rem;
  border-radius: 6.25rem;
  background: ${({ theme }) => theme.legacy.gold};
  color: ${({ theme }) => theme.legacy.black};
  font-family: Pretendard;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { opacity: 0.9; }
`;

const Message = styled.p`
  color: ${({ available, theme }) => (available ? theme.legacy.ok : theme.legacy.ng)};
  font-family: Pretendard;
  font-size: 1rem;
  font-weight: 700;
  text-align: center;
`;

const BottomText = styled.div`
  text-align: center;
  font-size: 1rem;
  color: ${({ theme }) => theme.colors.surface};
  margin-top: 1rem;
`;

const LinkText = styled.span`
  color: ${({ theme }) => theme.legacy.gold};
  cursor: pointer;
  margin-left: 4px;
  text-decoration: underline;
`;

export default function SignupScreen() {
  const navigate = useNavigate();
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [isIdAvailable, setIsIdAvailable] = useState(null);

  const handleCheckId = async () => {
    if (!userID.trim()) return;
        try {
          const { data } = await checkUserId(userID.trim());
          setIsIdAvailable(data.available);
        } catch {
          alert('ID 중복 확인에 실패했습니다.');
        }
  };

  const handleSignup = async () => {
    if (!userID || !password || !confirmPassword || !userName || !phoneNum) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (isIdAvailable !== true) {
      alert('사용 가능한 아이디인지 확인해주세요.');
      return;
    }

    try {
      const { data } = await signupUser({ userID, password, name: userName, phoneNumber: phoneNum });
      if (data.success) {
        alert('회원가입 성공! 로그인 화면으로 이동합니다.');
        navigate('/login');
      } else {
        alert(data.message || '회원가입에 실패했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <SignupContainer>
      <FrameWrapper>
        <TitleWrapper>
          <Title>꿈도깨비</Title>
          <SubTitle>나만의 이야기를 만들어봐요!</SubTitle>
        </TitleWrapper>

        <FormWrapper>
          <FieldGroup>
            <FieldWrapper>
              <Label htmlFor="userID">
                아이디
                <SmallCheckButton onClick={handleCheckId}>중복 확인</SmallCheckButton>
              </Label>
              <Input
                id="userID"
                type="text"
                placeholder="아이디"
                value={userID}
                onChange={e => { setUserID(e.target.value); setIsIdAvailable(null); }}
              />
              {isIdAvailable !== null && (
                <Message available={isIdAvailable}>
                  {isIdAvailable ? '사용 가능한 아이디입니다' : '이미 사용 중인 아이디입니다'}
                </Message>
              )}
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

            <FieldWrapper>
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호 확인"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && (
                <Message available={password === confirmPassword}>
                  {password === confirmPassword ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
                </Message>
              )}
            </FieldWrapper>

            <FieldWrapper>
              <Label htmlFor="userName">이름</Label>
              <Input
                id="userName"
                type="text"
                placeholder="이름"
                value={userName}
                onChange={e => setUserName(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper>
              <Label htmlFor="phoneNum">전화번호</Label>
              <Input
                id="phoneNum"
                type="text"
                placeholder="전화번호"
                value={phoneNum}
                onChange={e => setPhoneNum(e.target.value)}
              />
            </FieldWrapper>
          </FieldGroup>

          <SignupButton onClick={handleSignup}>회원가입</SignupButton>
        </FormWrapper>

        <BottomText>
          이미 계정이 있으신가요?
          <LinkText onClick={() => navigate('/login')}>로그인</LinkText>
        </BottomText>
      </FrameWrapper>
    </SignupContainer>
);
}