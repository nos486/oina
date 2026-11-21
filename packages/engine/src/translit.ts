/**
 * Tajik Cyrillic → Persian script converter.
 *
 * Cyrillic Tajik writes every vowel and Persian script does not, and several Persian letters
 * collapse into one Cyrillic letter (с = س/ص/ث, з = ز/ذ/ض/ظ, ҳ = ه/ح …). So a letter-by-letter
 * conversion can only ever be a good guess. We look every word up in a dictionary first (the
 * course words, the reading room and a list of common words) and fall back to spelling rules.
 * Each token says which of the two it came from, so the UI can mark the guesses.
 */

export type TranslitKind = 'dict' | 'rule' | 'other';

export interface TranslitToken {
  /** The original text of the token. */
  src: string;
  /** Its Persian-script form. */
  out: string;
  /** dict = from the dictionary (reliable), rule = spelled by rules (a guess), other = not a word. */
  kind: TranslitKind;
}

const ZWNJ = '‌';

/** Common words, so everyday sentences convert correctly. Lower case keys. */
export const COMMON_WORDS: Record<string, string> = {
  ва: 'و', ба: 'به', аз: 'از', дар: 'در', бо: 'با', то: 'تا', ки: 'که', чи: 'چه', чӣ: 'چه',
  ин: 'این', он: 'آن', инҳо: `این${ZWNJ}ها`, онҳо: `آن${ZWNJ}ها`, ман: 'من', ту: 'تو', вай: 'وی',
  мо: 'ما', шумо: 'شما', ӯ: 'او', ҳам: 'هم', ҳар: 'هر', на: 'نه', не: 'نه', бале: 'بله', ҳа: 'آره',
  агар: 'اگر', аммо: 'اما', валекин: 'ولیکن', лекин: 'لیکن', зеро: 'زیرا', барои: 'برای',
  аст: 'است', ҳаст: 'هست', нест: 'نیست', буд: 'بود', бувад: 'بود', шуд: 'شد',
  хуб: 'خوب', хеле: 'خیلی', бисёр: 'بسیار', ҳаме: 'همی', ҳама: 'همه', чун: 'چون', зи: 'ز',
  худо: 'خدا', имрӯз: 'امروز', дирӯз: 'دیروز', фардо: 'فردا', ҳоло: 'حالا', ҳамин: 'همین',
  ҳамон: 'همان', куҷо: 'کجا', кай: 'کی', кӣ: 'کی', чаро: 'چرا', чанд: 'چند',
  салом: 'سلام', раҳмат: 'رحمت', хайр: 'خیر', марҳамат: 'مرحمت', бубахшед: 'ببخشید',
  китоб: 'کتاب', дӯст: 'دوست', хона: 'خانه', эрон: 'ایران', тоҷикистон: 'تاجیکستان',
  душанбе: 'دوشنبه', самарқанд: 'سمرقند', бухоро: 'بخارا', забон: 'زبان', форсӣ: 'فارسی',
  тоҷикӣ: 'تاجیکی', тоҷик: 'تاجیک', мекунад: `می${ZWNJ}کند`, мекунам: `می${ZWNJ}کنم`,
  мешавад: `می${ZWNJ}شود`, медонам: `می${ZWNJ}دانم`, мехоҳам: `می${ZWNJ}خواهم`, кунад: 'کند',
  кардан: 'کردن', шудан: 'شدن', гуфт: 'گفت', пеш: 'پیش', баъд: 'بعد', дил: 'دل', ҷон: 'جان',
  ҷаҳон: 'جهان', одам: 'آدم', мардум: 'مردم', сол: 'سال', рӯз: 'روز', шаб: 'شب', об: 'آب',
  нон: 'نان', дарё: 'دریا', кӯҳ: 'کوه', шаҳр: 'شهر', ватан: 'وطن', модар: 'مادر', падар: 'پدر',
  бародар: 'برادر', хоҳар: 'خواهر', мактаб: 'مکتب', илм: 'علم', шеър: 'شعر', суруд: 'سرود',
  ишқ: 'عشق', ҳаво: 'هوا', ном: 'نام', номи: 'نام', калон: 'کلان', хурд: 'خرد', нав: 'نو',
  кӯча: 'کوچه', бозор: 'بازار', гул: 'گل', ҳафт: 'هفت', як: 'یک', ду: 'دو', се: 'سه',
  чор: 'چهار', панҷ: 'پنج', шаш: 'شش', ҳашт: 'هشت', нӯҳ: 'نه', даҳ: 'ده', сад: 'صد',
  ҳазор: 'هزار', ҳастам: 'هستم', ҳастӣ: 'هستی', ҳастед: 'هستید', ҳастанд: 'هستند',
  омадед: 'آمدید', омад: 'آمد', хуш: 'خوش', ҷо: 'جا', кор: 'کار', вақт: 'وقت', дониш: 'دانش',
  донишгоҳ: 'دانشگاه', муаллим: 'معلم', пойтахт: 'پایتخت', шогирд: 'شاگرد', дуруст: 'درست', ғалат: 'غلط',
};

/** Single-letter rules. Context-dependent letters (vowels) are handled in `spellWord`. */
const CONSONANTS: Record<string, string> = {
  б: 'ب', в: 'و', г: 'گ', ғ: 'غ', д: 'د', ж: 'ژ', з: 'ز', й: 'ی', к: 'ک', қ: 'ق', л: 'ل', м: 'م',
  н: 'ن', п: 'پ', р: 'ر', с: 'س', т: 'ت', ф: 'ف', х: 'خ', ҳ: 'ه', ч: 'چ', ҷ: 'ج', ш: 'ش',
  ц: 'تس', щ: 'شچ', ъ: 'ع', ь: '',
};
const VOWELS = new Set([...'аоиуӯеэӣёяюы']);

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const PUNCT: Record<string, string> = { ',': '،', '?': '؟', ';': '؛' };

/** Spells one lower-case Cyrillic word with the rules (no dictionary). */
export function spellWord(word: string): string {
  const ch = [...word];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i]!;
    const next = ch[i + 1];
    const first = i === 0 || ch[i - 1] === ZWNJ;
    const last = i === ch.length - 1;
    if (c in CONSONANTS) {
      out += CONSONANTS[c];
      continue;
    }
    switch (c) {
      case 'о':
        out += first ? 'آ' : 'ا';
        break;
      case 'а':
        // Short a: written only at the start (ا) and at the end (ه), as in хона → خانه.
        out += first ? 'ا' : last ? 'ه' : '';
        break;
      case 'и':
        if (first) out += 'ا';
        else if (last) out += 'ی';
        else if (next === 'ё' || next === 'я' || next === 'ю') out += '';
        else if (next && VOWELS.has(next)) out += 'ی';
        // Mid-word и is usually a short e (дил → دل, китоб → کتاب).
        break;
      case 'е':
      case 'э':
        out += first ? 'ای' : 'ی';
        break;
      case 'ӣ':
      case 'ы':
        out += 'ی';
        break;
      case 'у':
      case 'ӯ':
        out += first ? 'او' : 'و';
        break;
      case 'ё':
        out += 'یا';
        break;
      case 'я':
        out += first || last ? 'یا' : 'ی';
        break;
      case 'ю':
        out += 'یو';
        break;
      default:
        out += c;
    }
  }
  return out;
}

/** Suffixes split off before a dictionary lookup, longest first. */
const SUFFIXES: [string, string][] = [
  ['ҳоро', `${ZWNJ}ها را`],
  ['ҳои', `${ZWNJ}های`],
  ['ҳо', `${ZWNJ}ها`],
  ['ро', ' را'],
  ['ам', 'م'],
  ['ат', 'ت'],
  ['аш', 'ش'],
  ['ӣ', 'ی'],
  ['и', 'ِ'],
];

function lookupWord(lower: string, dict: Map<string, string>): string | undefined {
  const hit = dict.get(lower);
  if (hit) return hit;
  for (const [suf, fa] of SUFFIXES) {
    if (lower.length > suf.length + 1 && lower.endsWith(suf)) {
      const stem = dict.get(lower.slice(0, -suf.length));
      if (stem) {
        // A stem that ends in a silent ه takes ی for the izafe: хонаи → خانه‌ی.
        if (suf === 'и' && stem.endsWith('ه')) return stem + ZWNJ + 'ی';
        return stem + fa;
      }
    }
  }
  // Present-tense prefix ме-: мехонам → می‌خوانم.
  for (const pre of ['наме', 'ме']) {
    if (lower.startsWith(pre) && lower.length > pre.length + 2) {
      const rest = lower.slice(pre.length);
      const fa = pre === 'ме' ? 'می' : 'نمی';
      const known = dict.get(rest);
      if (known) return fa + ZWNJ + known;
    }
  }
  return undefined;
}

function convertWord(word: string, dict: Map<string, string>): TranslitToken {
  const lower = word.toLowerCase();
  // Hyphenated words are converted part by part: қатра-қатра → قطره‌قطره.
  if (lower.includes('-')) {
    const parts = word.split('-').map((w) => convertWord(w, dict));
    return { src: word, out: parts.map((p) => p.out).join(ZWNJ), kind: parts.every((p) => p.kind === 'dict') ? 'dict' : 'rule' };
  }
  const known = lookupWord(lower, dict);
  if (known) return { src: word, out: known, kind: 'dict' };
  for (const pre of ['наме', 'ме']) {
    if (lower.startsWith(pre) && lower.length > pre.length + 2) {
      return { src: word, out: (pre === 'ме' ? 'می' : 'نمی') + ZWNJ + spellWord(lower.slice(pre.length)), kind: 'rule' };
    }
  }
  return { src: word, out: spellWord(lower), kind: 'rule' };
}

/** Builds the lookup table (lower-case Cyrillic → Persian). Later entries win. */
export function buildTranslitDict(...sources: Iterable<[string, string]>[]): Map<string, string> {
  const dict = new Map<string, string>(Object.entries(COMMON_WORDS));
  for (const src of sources) for (const [cyr, fa] of src) if (cyr && fa) dict.set(cyr.toLowerCase(), fa);
  return dict;
}

const WORD = /[\p{Script=Cyrillic}]+(?:-[\p{Script=Cyrillic}]+)*/gu;

/** Converts a text into tokens: words (dictionary or rules) and everything in between. */
export function cyrillicToPersian(text: string, dict: Map<string, string> = buildTranslitDict()): TranslitToken[] {
  const tokens: TranslitToken[] = [];
  const other = (s: string) => {
    if (!s) return;
    const out = [...s].map((c) => (c >= '0' && c <= '9' ? PERSIAN_DIGITS[Number(c)] : (PUNCT[c] ?? c))).join('');
    tokens.push({ src: s, out, kind: 'other' });
  };
  let at = 0;
  for (const m of text.matchAll(WORD)) {
    other(text.slice(at, m.index));
    tokens.push(convertWord(m[0], dict));
    at = m.index + m[0].length;
  }
  other(text.slice(at));
  return tokens;
}

/** Splits a reading line into words for word-by-word reveal (punctuation stays attached). */
export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

/** Strips punctuation around a word, for dictionary keys. */
export function bareWord(w: string): string {
  return w.replace(/^[^\p{L}]+|[^\p{L}‌]+$/gu, '');
}
