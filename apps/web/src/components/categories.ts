import type { Category } from '@oina/shared';

export const CATEGORY: Record<Category, { labelFa: string; color: string; bg: string }> = {
  friend: { labelFa: 'آشنا', color: 'text-cat-friend', bg: 'bg-cat-friend' },
  trap: { labelFa: 'فریبکار', color: 'text-cat-trap', bg: 'bg-cat-trap' },
  new: { labelFa: 'تازه', color: 'text-cat-new', bg: 'bg-cat-new' },
  tajik: { labelFa: 'ویژه‌ی تاجیکی', color: 'text-cat-tajik', bg: 'bg-cat-tajik' },
  combo: { labelFa: 'ترکیبی', color: 'text-cat-other', bg: 'bg-cat-other' },
  sign: { labelFa: 'علامت', color: 'text-cat-other', bg: 'bg-cat-other' },
  russianOnly: { labelFa: 'فقط روسی', color: 'text-cat-other', bg: 'bg-cat-other' },
};
