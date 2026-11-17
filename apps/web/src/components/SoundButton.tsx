import { useContent } from '../state/content';
import { useProgress } from '../state/progress';
import { playAudio } from '../lib/audio';

/** Plays a recorded file. Greyed out when the file does not exist yet (design doc, section 6). */
export function SoundButton({ path, slow = false, size = 'md', label = 'پخش صدا' }: { path?: string; slow?: boolean; size?: 'md' | 'lg'; label?: string }) {
  const { audio } = useContent();
  const { settings } = useProgress();
  const available = !!path && audio.has(path) && settings.sound;
  const dim = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-lg';
  return (
    <button
      type="button"
      aria-label={available ? label : `${label} (صدا هنوز ضبط نشده)`}
      title={available ? label : 'صدا هنوز ضبط نشده'}
      disabled={!available}
      onClick={() => path && playAudio(path, slow)}
      className={`${dim} grid shrink-0 place-items-center rounded-2xl border-2 border-b-4 border-primary bg-primary-soft text-primary transition active:translate-y-0.5 disabled:border-line disabled:bg-surface-2 disabled:text-muted disabled:opacity-60`}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
