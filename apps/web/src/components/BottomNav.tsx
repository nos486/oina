import { Link, useLocation } from 'react-router';
import { NAV, isActive } from './nav';

/** Phone tab bar, like a native app. Hidden on desktop, where the sidebar takes over. */
export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="ناوبری اصلی" className="glass fixed inset-x-0 bottom-0 z-30 border-t border-line/70 pb-[env(safe-area-inset-bottom)] select-none md:hidden">
      <ul className="mx-auto grid max-w-[720px] grid-cols-5 px-1">
        {NAV.filter((t) => t.tab).map((t) => {
          const active = isActive(t, pathname);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-bold transition active:scale-95 ${active ? 'text-primary' : 'text-muted'}`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-all duration-300 ${active ? 'bg-primary-soft' : ''}`}>
                  <t.Icon width={22} height={22} strokeWidth={active ? 2.4 : 2} />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
