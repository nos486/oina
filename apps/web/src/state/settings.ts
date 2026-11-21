import { useEffect } from 'react';
import { useProgress } from './progress';

/** Applies theme and font size from settings to <html>. */
export function useApplySettings() {
  const { settings } = useProgress();
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      root.classList.toggle('dark', dark);
      // Status bar / title bar colour follows the app's theme, like a native app.
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
        m.setAttribute('content', dark ? '#101618' : '#faf6ee');
        m.removeAttribute('media');
      });
    };
    apply();
    root.style.setProperty('--font-scale', String(settings.fontScale));
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, settings.fontScale]);
}
