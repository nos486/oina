const fa = new Intl.NumberFormat('fa-IR');
/** Persian digits. */
export const n = (x: number) => fa.format(Math.round(x));
export const pct = (x: number) => `${n(x * 100)}٪`;
