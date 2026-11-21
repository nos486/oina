import { describe, expect, it } from 'vitest';
import { buildTranslitDict, cyrillicToPersian, spellWord } from '../src/translit';

const conv = (s: string, dict = buildTranslitDict()) => cyrillicToPersian(s, dict).map((t) => t.out).join('');

describe('spellWord (rules only)', () => {
  it('writes о as alef, آ at the start', () => {
    expect(spellWord('нон')).toBe('نان');
    expect(spellWord('об')).toBe('آب');
  });
  it('drops mid-word short a and writes a final a as ه', () => {
    expect(spellWord('кам')).toBe('کم');
    expect(spellWord('хона')).toBe('خانه');
    expect(spellWord('зинда')).toBe('زنده');
  });
  it('handles the Tajik letters', () => {
    expect(spellWord('ҷон')).toBe('جان');
    expect(spellWord('қанд')).toBe('قند');
    expect(spellWord('ғам')).toBe('غم');
    expect(spellWord('рӯз')).toBe('روز');
    expect(spellWord('форсӣ')).toBe('فارسی');
  });
  it('writes ё as یا and medial я as ی', () => {
    expect(spellWord('дарё')).toBe('دریا');
    expect(spellWord('ояд')).toBe('آید');
    expect(spellWord('сиёҳ')).toBe('سیاه');
  });
  it('writes е as ی and ъ as ع', () => {
    expect(spellWord('хеле')).toBe('خیلی');
    expect(spellWord('маъно')).toBe('معنا');
  });
});

describe('cyrillicToPersian', () => {
  it('prefers the dictionary and marks guesses', () => {
    const t = cyrillicToPersian('Ин китоб', buildTranslitDict());
    expect(t.map((x) => x.kind)).toEqual(['dict', 'other', 'dict']);
    expect(t.map((x) => x.out).join('')).toBe('این کتاب');
  });
  it('uses extra dictionary sources', () => {
    expect(conv('ҳикоят', buildTranslitDict([['ҳикоят', 'حکایت']]))).toBe('حکایت');
  });
  it('converts punctuation and digits', () => {
    expect(conv('Салом, 12?')).toBe('سلام، ۱۲؟');
  });
  it('splits known suffixes and the ме- prefix', () => {
    expect(conv('китобҳо')).toBe('کتاب‌ها');
    expect(conv('китобро')).toBe('کتاب را');
    expect(conv('хонаи')).toBe('خانه‌ی');
    expect(conv('мекунад')).toBe('می‌کند');
    expect(conv('мерафт')).toBe('می‌رفت');
  });
  it('keeps hyphenated words together', () => {
    expect(conv('кам-кам')).toBe('کم‌کم');
  });
  it('leaves non-Cyrillic text alone', () => {
    expect(conv('Oina 2026')).toBe('Oina ۲۰۲۶');
  });
});
