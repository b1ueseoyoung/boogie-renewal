// Spring(C-4) 캐릭터 API. 실패하면 C-2 본문을 error로 그대로 돌려준다(본문이 C-2가 아니면 아래 기본 오류).
const FALLBACK_ERROR = {
  errorClass: 'error',
  message: '문제가 생겼어요. 다시 시도해 주세요.',
  retryable: true,
  resetsAt: null,
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// 성공: { success: true, body }  실패: { success: false, error: C-2 본문 }
async function request(path, init) {
  let response;
  try {
    response = await fetch(`${process.env.REACT_APP_API_BASE_URL}${path}`, init);
  } catch (networkError) {
    return { success: false, error: FALLBACK_ERROR };
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || body === null) {
    return { success: false, error: body && body.errorClass ? body : FALLBACK_ERROR };
  }
  return { success: true, body };
}

// POST /character → { charId, charImg, candidateId, candidates: [{ candidateId, imgUrl }] }
export async function postCharacter(payload) {
  const result = await request('/character', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  return result.success ? { success: true, ...result.body } : result;
}

// GET /character/{charId}/candidates → candidates: [{ candidateId, imgUrl, approved }]
export async function getCandidates(charId) {
  const result = await request(`/character/${charId}/candidates`);
  return result.success ? { success: true, candidates: result.body } : result;
}

// POST /character/{charId}/candidates → candidate: { candidateId, imgUrl } (후보가 3개면 409 candidate_limit)
export async function regenerateCandidate(charId) {
  const result = await request(`/character/${charId}/candidates`, { method: 'POST' });
  return result.success ? { success: true, candidate: result.body } : result;
}

// POST /character/{charId}/approve → { charId, charImg, charLook }
export async function approveCandidate(charId, candidateId) {
  const result = await request(`/character/${charId}/approve`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ candidateId }),
  });
  return result.success ? { success: true, ...result.body } : result;
}
