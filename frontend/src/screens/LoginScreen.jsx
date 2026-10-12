import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { authUserState } from '../recoil/atoms';
import { loginUser, errorMessage } from '../api/auth';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import FormField, { FormStack, FormAlert, AltLine, TextButton, Mascot, AuthBrand } from '../components/FormField';

const EMPTY_MESSAGE = '아이디와 비밀번호를 모두 적어 주세요.';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuthUser = useSetRecoilState(authUserState);
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [empty, setEmpty] = useState({}); // 비어 있는 칸 { userID, password }
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    const id = userID.trim();
    if (!id || !password) {
      setEmpty({ userID: !id, password: !password });
      setFormError('');
      return;
    }
    setEmpty({});
    setFormError('');
    setPending(true);
    try {
      const { data } = await loginUser({ userID: id, password });
      setAuthUser({ userId: data.userId, userName: data.userName });
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <BaseScreenLayout
      title="다시 만나서 반가워요!"
      subTitle="아이디와 비밀번호를 적으면 책장이 열려요."
      aside={<Mascot />}
      brand={<AuthBrand />}
    >
      <FormStack onSubmit={handleSubmit} noValidate>
        <FormField
          id="userID"
          label="아이디"
          autoComplete="username"
          autoCapitalize="none"
          value={userID}
          onChange={(e) => setUserID(e.target.value)}
          error={empty.userID ? EMPTY_MESSAGE : undefined}
        />
        {/* 둘 다 비었으면 문구는 아이디 칸에 한 번만 둔다. 비밀번호 칸은 빨간 테두리로 알리고, 화면 읽기에는 그 문구를 이어 읽힌다 */}
        <FormField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={empty.password && !empty.userID ? EMPTY_MESSAGE : undefined}
          aria-invalid={empty.password ? 'true' : undefined}
          aria-describedby={empty.password && empty.userID ? 'userID-note' : undefined}
        />
        <FormAlert>{formError}</FormAlert>
        <RoundedButton type="submit" $primary disabled={pending}>
          {pending ? '여는 중…' : '로그인'}
        </RoundedButton>
        <AltLine>
          처음이에요?
          <TextButton type="button" onClick={() => navigate('/signup')}>
            회원가입
          </TextButton>
        </AltLine>
      </FormStack>
    </BaseScreenLayout>
  );
}
