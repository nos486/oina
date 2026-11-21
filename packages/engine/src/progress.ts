import type { ExamRecord, ItemKey, Progress, Settings } from '@oina/shared';

export const MAX_HEARTS = 5;
export const MAX_RECENT_MISTAKES = 20;

export const letterKey = (id: string): ItemKey => `letter:${id}`;
export const wordKey = (id: string): ItemKey => `word:${id}`;

export function parseItemKey(key: string): { kind: 'letter' | 'word'; id: string } | null {
  const m = /^(letter|word):(.+)$/.exec(key);
  return m ? { kind: m[1] as 'letter' | 'word', id: m[2]! } : null;
}

export const DEFAULT_SETTINGS: Settings = {
  track: 'tg',
  theme: 'system',
  fontScale: 1,
  hearts: true,
};

export function createProgress(now: Date = new Date()): Progress {
  return {
    version: 1,
    onboarded: false,
    completedLessons: [],
    stageStars: {},
    items: {},
    confusions: {},
    recentMistakes: [],
    lessonLevels: {},
    reviewStars: {},
    exams: [],
    hearts: { count: MAX_HEARTS, lastRefill: now.toISOString() },
    dailyGoal: 20,
    xpByDay: {},
    badges: [],
    xp: 0,
    streak: { count: 0, lastDay: '' },
    settings: { ...DEFAULT_SETTINGS },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const MAX_EXAMS = 20;

function normalizeExams(raw: unknown): ExamRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is ExamRecord => isObj(e) && typeof e.at === 'string' && typeof e.correct === 'number' && typeof e.total === 'number' && e.total > 0)
    .map(({ at, correct, total }) => ({ at, correct, total }))
    .slice(0, MAX_EXAMS);
}

function normalizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {};
  return {
    track: s.track === 'ru' || s.track === 'both' ? s.track : 'tg',
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    fontScale: typeof s.fontScale === 'number' && Number.isFinite(s.fontScale) ? s.fontScale : DEFAULT_SETTINGS.fontScale,
    hearts: typeof s.hearts === 'boolean' ? s.hearts : DEFAULT_SETTINGS.hearts,
  };
}

/**
 * Accepts anything (old localStorage data, an imported JSON file, a future server copy)
 * and returns a valid Progress. Unknown fields are dropped; missing fields get defaults.
 */
export function normalizeProgress(raw: unknown, now: Date = new Date()): Progress {
  const base = createProgress(now);
  if (!isObj(raw) || raw.version !== 1) return base;
  const p = raw as Partial<Progress>;
  const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    version: 1,
    onboarded: p.onboarded === true,
    completedLessons: arr(p.completedLessons),
    stageStars: isObj(p.stageStars) ? (p.stageStars as Progress['stageStars']) : {},
    items: isObj(p.items) ? (p.items as Progress['items']) : {},
    confusions: isObj(p.confusions) ? (p.confusions as Progress['confusions']) : {},
    recentMistakes: arr(p.recentMistakes).slice(0, MAX_RECENT_MISTAKES),
    lessonLevels: isObj(p.lessonLevels) ? (p.lessonLevels as Progress['lessonLevels']) : {},
    reviewStars: isObj(p.reviewStars) ? (p.reviewStars as Progress['reviewStars']) : {},
    exams: normalizeExams(p.exams),
    hearts: isObj(p.hearts)
      ? { count: Math.min(MAX_HEARTS, Math.max(0, num(p.hearts.count, MAX_HEARTS))), lastRefill: String(p.hearts.lastRefill ?? base.hearts.lastRefill) }
      : base.hearts,
    dailyGoal: p.dailyGoal === 50 || p.dailyGoal === 100 ? p.dailyGoal : 20,
    xpByDay: isObj(p.xpByDay) ? (p.xpByDay as Progress['xpByDay']) : {},
    badges: arr(p.badges),
    xp: num(p.xp, 0),
    streak: isObj(p.streak) ? { count: num(p.streak.count, 0), lastDay: String(p.streak.lastDay ?? '') } : base.streak,
    settings: normalizeSettings(p.settings),
  };
}

/**
 * Merge rule for future sync between devices: "most progress wins", per field.
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const items: Progress['items'] = { ...a.items };
  for (const [k, v] of Object.entries(b.items)) {
    const cur = items[k];
    if (!cur || v.lastSeen > cur.lastSeen) items[k] = v;
  }
  const maxRecord = <T extends Record<string, number>>(x: T, y: T): T => {
    const out: Record<string, number> = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] ?? 0, v);
    return out as T;
  };
  const newer = a.streak.lastDay >= b.streak.lastDay ? a : b;
  return {
    ...newer,
    onboarded: a.onboarded || b.onboarded,
    completedLessons: [...new Set([...a.completedLessons, ...b.completedLessons])],
    stageStars: maxRecord(a.stageStars, b.stageStars),
    items,
    confusions: maxRecord(a.confusions, b.confusions),
    lessonLevels: maxRecord(a.lessonLevels, b.lessonLevels),
    reviewStars: maxRecord(a.reviewStars, b.reviewStars),
    exams: [...new Map([...a.exams, ...b.exams].map((e) => [e.at, e])).values()].sort((x, y) => (x.at < y.at ? 1 : -1)).slice(0, MAX_EXAMS),
    xpByDay: maxRecord(a.xpByDay, b.xpByDay),
    badges: [...new Set([...a.badges, ...b.badges])],
    xp: Math.max(a.xp, b.xp),
  };
}
