import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { authUserState } from '../recoil/atoms';
import { loginUser, errorMessage } from '../api/auth';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import FormField, { FormStack, TextButton, Mascot } from '../components/FormField';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthUser = useSetRecoilState(authUserState);
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    const id = userID.trim();
    if (!id || !password) {
      setError('아이디와 비밀번호를 모두 적어 주세요.');
      return;
    }
    setError('');
    setPending(true);
    try {
      const { data } = await loginUser({ userID: id, password });
      setAuthUser({ userId: data.userId, userName: data.userName });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <BaseScreenLayout title="다시 만나서 반가워요!" subTitle="아이디와 비밀번호를 적으면 책장이 열려요." aside={<Mascot />}>
      <FormStack onSubmit={handleSubmit} noValidate>
        <FormField
          id="userID"
          label="아이디"
          autoComplete="username"
          autoCapitalize="none"
          value={userID}
          onChange={(e) => setUserID(e.target.value)}
        />
        <FormField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <RoundedButton type="submit" $primary disabled={pending}>
          {pending ? '여는 중…' : '로그인'}
        </RoundedButton>
        <TextButton type="button" onClick={() => navigate('/signup')}>
          처음이에요? 회원가입
        </TextButton>
      </FormStack>
    </BaseScreenLayout>
  );
}
