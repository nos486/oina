import { AUDIO_BASE } from './config';

let current: HTMLAudioElement | null = null;

/** Plays a file from the audio base. Returns false if it could not play. */
export async function playAudio(path: string, slow = false): Promise<boolean> {
  try {
    current?.pause();
    const a = new Audio(AUDIO_BASE + path);
    a.playbackRate = slow ? 0.7 : 1;
    current = a;
    await a.play();
    return true;
  } catch {
    return false;
  }
}

/** Russian only: the browser voice. Never used for Tajik (it misreads Ҷ Ҳ Қ Ғ). */
export function speakRussian(text: string, slow = false): boolean {
  if (typeof speechSynthesis === 'undefined') return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  u.rate = slow ? 0.7 : 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}
