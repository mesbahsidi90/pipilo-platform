// Spoken calls for the waiting screen (TV browser speech synthesis).
export function announcementText(number, { lang = 'ar', clinic = false, room = '' } = {}) {
  const n = String(number).trim();
  const where = String(room || '').trim();
  if (lang === 'fr')
    return clinic
      ? where
        ? `Numéro ${n}, allez à : ${where}.`
        : `Numéro ${n}, présentez-vous à l’accueil.`
      : `Commande numéro ${n}, votre commande est prête.`;
  if (clinic && where) return `الرقم ${n}، تفضّل لـ ${where}.`;
  return clinic ? `الرقم ${n}، تفضّل للاستقبال.` : `الطلب رقم ${n}، طلبك واجد.`;
}

export function newlyReady(previous, current) {
  if (!previous) return [];
  return [...current].filter((number) => !previous.has(number));
}

export function pickVoice(voices, lang) {
  const wanted = lang === 'fr' ? 'fr' : 'ar';
  return voices.find((v) => v.lang?.toLowerCase().startsWith(wanted)) || null;
}

// Returns false when the device has no voice for the language (many TVs lack
// Arabic); the chime still plays in that case.
export function speakCalls(numbers, options, synth = globalThis.speechSynthesis) {
  if (!synth || !numbers.length || typeof SpeechSynthesisUtterance === 'undefined') return false;
  const voice = pickVoice(synth.getVoices(), options.lang);
  if (!voice) return false;
  for (const number of numbers.slice(0, 4)) {
    const utterance = new SpeechSynthesisUtterance(
      announcementText(number, { ...options, room: options.rooms?.[number] }),
    );
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.92;
    synth.speak(utterance);
  }
  return true;
}

// Calls to announce: numbers newly ready, and numbers staff called again
// (their call time moved on). `previous` / `current`: Map number → time.
export function newCalls(previous, current) {
  if (!previous) return [];
  return [...current.entries()]
    .filter(([number, at]) => !previous.has(number) || at > previous.get(number))
    .map(([number]) => number);
}
