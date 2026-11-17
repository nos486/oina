import { NavLink } from 'react-router';

const TABS = [
  { to: '/', label: 'مسیر', icon: '🗺️' },
  { to: '/alphabet', label: 'الفبا', icon: 'Аа' },
  { to: '/review', label: 'مرور', icon: '🔁' },
  { to: '/reading', label: 'خواندن', icon: '📖' },
  { to: '/tools', label: 'ابزار', icon: '⚙️' },
];

/** Bottom tab bar on phones; a top bar on wide screens. */
export function BottomNav() {
  return (
    <nav aria-label="ناوبری اصلی" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:sticky md:top-[53px] md:bottom-auto md:border-t-0 md:border-b">
      <ul className="mx-auto grid max-w-[720px] grid-cols-5">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-primary' : 'text-muted'}`
              }
            >
              <span aria-hidden className={`text-lg leading-none ${t.icon === 'Аа' ? 'cyr font-bold' : ''}`} dir="ltr">{t.icon}</span>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
