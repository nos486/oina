import type { ComponentType, SVGProps } from 'react';
import { IconAlphabet, IconBook, IconConvert, IconPath, IconReview, IconSettings, IconUser } from './icons';

export interface NavItem {
  to: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Extra paths that also light this item up. */
  also?: string[];
  /** Shown in the phone tab bar (at most five). */
  tab?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'مسیر', Icon: IconPath, tab: true },
  { to: '/alphabet', label: 'الفبا', Icon: IconAlphabet, tab: true },
  { to: '/review', label: 'مرور', Icon: IconReview, tab: true },
  { to: '/reading', label: 'خواندن', Icon: IconBook, tab: true },
  { to: '/converter', label: 'مبدل خط', Icon: IconConvert },
  { to: '/profile', label: 'من', Icon: IconUser, tab: true, also: ['/tools'] },
  { to: '/tools', label: 'تنظیمات', Icon: IconSettings },
];

export function isActive(item: NavItem, pathname: string, exactOnly = false): boolean {
  if (item.to === '/') return pathname === '/';
  if (pathname === item.to || pathname.startsWith(item.to + '/')) return true;
  return !exactOnly && !!item.also?.some((a) => pathname === a);
}
