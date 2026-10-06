const FALLBACK_ERROR = {
  errorClass: 'error',
  message: '문제가 생겼어요. 다시 시도해 주세요.',
  retryable: true,
  resetsAt: null,
};

export async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(`${process.env.REACT_APP_FILE_BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (networkError) {
    throw Object.assign(new Error('upload failed'), FALLBACK_ERROR);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body || !body.url) {
    throw Object.assign(
      new Error('upload failed'),
      body && body.errorClass ? body : FALLBACK_ERROR
    );
  }

  return body.url;
}
