// Spring(C-4) POST /story. throw 하지 않는다.
// 성공(200, 201): { status, data }  실패: { status, error: C-2 본문 }
const FALLBACK_ERROR = { errorClass: 'error', retryable: true };

export async function postStoryNext({ choice }) {
  let res;
  try {
    res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/story`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choice }),
    });
  } catch (networkError) {
    return { status: 0, error: FALLBACK_ERROR };
  }

  const body = await res.json().catch(() => null);
  if (res.ok && body !== null) {
    return { status: res.status, data: body };
  }
  return { status: res.status, error: body && body.errorClass ? body : FALLBACK_ERROR };
}
