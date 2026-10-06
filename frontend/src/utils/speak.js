let finish = null;

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
  finish?.(false);
}

// 끝까지 읽으면 true, 음성 기능이 없거나 중간에 멈췄거나 오류면 false.
export function speak(text) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance || !text) return Promise.resolve(false);
  stopSpeaking();

  return new Promise((resolve) => {
    const done = (ok) => {
      if (finish === done) finish = null;
      resolve(ok);
    };
    finish = done;
    try {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      // 목소리 목록이 아직 비어 있으면(Chrome은 늦게 채운다) lang만으로 읽는다.
      const voice = synth.getVoices().find((v) => v.lang?.startsWith('ko'));
      if (voice) utterance.voice = voice;
      utterance.onend = () => done(true);
      utterance.onerror = () => done(false);
      synth.speak(utterance);
    } catch (err) {
      console.error('[speak 오류]', err);
      done(false);
    }
  });
}
