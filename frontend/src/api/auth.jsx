// Spring 세션 로그인 API(계약 13). 세션 쿠키를 주고받으려 withCredentials를 켠다.
// 오류 본문은 C-2 모양 { errorClass, message, retryable, resetsAt }.
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// POST /signup → 201 { userId, userName } + 로그인된 세션. 400 invalid, 409 duplicate_id
export function signupUser({ userID, password, userName }) {
  return api.post('/signup', { userID, password, userName });
}

// POST /login → 200 { userId, userName }. 401 bad_credentials
export function loginUser({ userID, password }) {
  return api.post('/login', { userID, password });
}

// POST /logout → 204
export function logoutUser() {
  return api.post('/logout');
}

// GET /me → 200 { userId, userName } / 401 auth_required
export function fetchMe() {
  return api.get('/me');
}

// GET /api/users/check?userID= → 200 { available }
export function checkUserId(userID) {
  return api.get('/api/users/check', { params: { userID } });
}

// axios 오류에서 서버의 한국어 메시지를 꺼낸다. 없으면(네트워크 끊김 등) 기본 문구
export function errorMessage(err) {
  return err?.response?.data?.message || '문제가 생겼어요. 다시 시도해 주세요.';
}

export function errorClass(err) {
  return err?.response?.data?.errorClass || 'error';
}
