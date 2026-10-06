import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { authUserState } from '../recoil/atoms';
import { signupUser, checkUserId, errorMessage, errorClass } from '../api/auth';
import BaseScreenLayout from '../components/BaseScreenLayout';
import RoundedButton from '../components/RoundedButton';
import FormField, { FormStack, TextButton, SideButton, Mascot } from '../components/FormField';

const ID_RULE = /^[a-z0-9_]{4,20}$/;

const Form = styled(FormStack)`
  max-width: 38rem;
`;

const Fields = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space[3]};
  grid-template-columns: 1fr;

  @media (min-width: 52.0625rem) {
    grid-template-columns: 1fr 1fr;
    column-gap: ${({ theme }) => theme.space[4]};
  }
`;

const ID_STATUS = {
  ok: { ok: '사용할 수 있어요' },
  taken: { error: '이미 쓰는 아이디예요' },
  invalid: { error: '아이디는 영문 소문자, 숫자, _ 로 4~20자예요' },
};

function validate({ userID, password, confirm, userName }) {
  const errors = {};
  if (!ID_RULE.test(userID)) errors.userID = '아이디는 영문 소문자, 숫자, _ 로 4~20자예요';
  if (password.length < 8 || password.length > 64) errors.password = '비밀번호는 8자 이상 64자 이하예요';
  if (confirm !== password) errors.confirm = '비밀번호가 서로 달라요';
  if (userName.length < 1 || userName.length > 20) errors.userName = '이름을 1~20자로 적어 주세요';
  return errors;
}

export default function SignupScreen() {
  const navigate = useNavigate();
  const setAuthUser = useSetRecoilState(authUserState);
  const [userID, setUserID] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [userName, setUserName] = useState('');
  const [idStatus, setIdStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);

  const handleCheckId = async () => {
    const id = userID.trim();
    if (!ID_RULE.test(id)) {
      setIdStatus('invalid');
      return;
    }
    try {
      const { data } = await checkUserId(id);
      setIdStatus(data.available ? 'ok' : 'taken');
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: errorMessage(err) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pending) return;
    const values = { userID: userID.trim(), password, confirm, userName: userName.trim() };
    const next = validate(values);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      const { data } = await signupUser(values);
      setAuthUser({ userId: data.userId, userName: data.userName });
      navigate('/', { replace: true });
    } catch (err) {
      const key = errorClass(err) === 'duplicate_id' ? 'userID' : 'form';
      setErrors({ [key]: errorMessage(err) });
      if (key === 'userID') setIdStatus(null);
      setPending(false);
    }
  };

  const idNote = idStatus ? ID_STATUS[idStatus] : {};

  return (
    <BaseScreenLayout title="처음 왔구나, 반가워요!" subTitle="아이디와 이름을 정하면 바로 시작할 수 있어요." aside={<Mascot />}>
      <Form onSubmit={handleSubmit} noValidate>
        <Fields>
          <FormField
            id="userID"
            label="아이디"
            autoComplete="username"
            autoCapitalize="none"
            value={userID}
            onChange={(e) => {
              setUserID(e.target.value);
              setIdStatus(null);
            }}
            hint="영문 소문자, 숫자, _ 로 4~20자"
            error={errors.userID || idNote.error}
            ok={idNote.ok}
            side={
              <SideButton type="button" onClick={handleCheckId} disabled={!userID.trim()}>
                중복 확인
              </SideButton>
            }
          />
          <FormField
            id="userName"
            label="이름"
            autoComplete="name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            hint="책에 적힐 이름이에요"
            error={errors.userName}
          />
          <FormField
            id="password"
            label="비밀번호"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="8자 이상"
            error={errors.password}
          />
          <FormField
            id="confirm"
            label="비밀번호 확인"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm || errors.form}
          />
        </Fields>
        <RoundedButton type="submit" $primary disabled={pending}>
          {pending ? '준비하는 중…' : '가입하고 시작하기'}
        </RoundedButton>
        <TextButton type="button" onClick={() => navigate('/login')}>
          이미 계정이 있어요? 로그인
        </TextButton>
      </Form>
    </BaseScreenLayout>
  );
}
