import type { ContentBundle } from '@oina/shared';
import { buildIndex, uniqueLetters } from './content-index.js';

export interface ContentIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export const MIN_WORDS_PER_LESSON = 8;

/**
 * Checks the content rules from the design doc. Errors must block a build;
 * warnings are for the content reviewer.
 */
export function validateContent(bundle: ContentBundle): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });
  const index = buildIndex(bundle);

  const dupes = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(kind, `duplicate id "${id}"`);
      seen.add(id);
    }
  };
  dupes('letters', bundle.letters.map((l) => l.id));
  dupes('words', bundle.words.map((w) => w.id));
  dupes('lessons', bundle.lessons.map((l) => l.id));
  dupes('stages', bundle.stages.map((s) => String(s.id)));

  // Words: every character is a known letter, and `letters` is in sync.
  for (const w of bundle.words) {
    const where = `word "${w.id}"`;
    if (!/^[a-z0-9-]+$/.test(w.id)) err(where, 'id must be lowercase ascii (a-z, 0-9, -)');
    const split = uniqueLetters(w.cyrillic, index.letterByChar);
    const unknown = [...w.cyrillic.normalize('NFC')].filter(
      (ch) => !/[\s\-.,!?]/.test(ch) && !index.letterByChar.has(ch),
    );
    if (unknown.length) err(where, `unknown characters: ${unknown.join(' ')} (Latin lookalikes?)`);
    if (split.join(',') !== w.letters.join(',')) {
      err(where, `letters out of sync: expected [${split.join(', ')}], run "pnpm content:sync"`);
    }
    if (!w.persian.trim()) err(where, 'missing persian');
    if (w.distractors?.includes(w.persian)) err(where, 'a distractor equals the answer');
  }

  // Letters: examples exist.
  for (const l of bundle.letters) {
    for (const ex of l.examples) {
      if (!index.wordById.has(ex)) err(`letter "${l.id}"`, `example word "${ex}" does not exist`);
    }
  }

  // Stages reference real lessons; each lesson sits in exactly one stage.
  const lessonStage = new Map<string, number>();
  for (const s of bundle.stages) {
    for (const id of s.lessons) {
      if (!index.lessonById.has(id)) err(`stage ${s.id}`, `lesson "${id}" does not exist`);
      if (lessonStage.has(id)) err(`stage ${s.id}`, `lesson "${id}" is in more than one stage`);
      lessonStage.set(id, s.id);
    }
  }
  for (const lesson of bundle.lessons) {
    if (!lessonStage.has(lesson.id)) err(`lesson "${lesson.id}"`, 'not listed in any stage');
    else if (lessonStage.get(lesson.id) !== lesson.stageId) {
      err(`lesson "${lesson.id}"`, `stageId ${lesson.stageId} but listed in stage ${lessonStage.get(lesson.id)}`);
    }
  }

  // The core rule: a lesson only uses letters taught up to that lesson.
  const known = new Set<string>();
  const taughtIn = new Map<string, string>();
  for (const lesson of index.lessonOrder) {
    const where = `lesson "${lesson.id}"`;
    for (const l of lesson.newLetters) {
      if (!index.letterById.has(l)) err(where, `new letter "${l}" does not exist`);
      if (taughtIn.has(l)) err(where, `letter "${l}" is already taught in ${taughtIn.get(l)}`);
      taughtIn.set(l, lesson.id);
      known.add(l);
    }
    for (const wid of lesson.words) {
      const w = index.wordById.get(wid);
      if (!w) {
        err(where, `word "${wid}" does not exist`);
        continue;
      }
      const missing = uniqueLetters(w.cyrillic, index.letterByChar).filter((l) => !known.has(l));
      if (missing.length) {
        err(where, `word "${w.cyrillic}" uses letters not taught yet: ${missing.map((m) => index.letterById.get(m)?.upper ?? m).join(' ')}`);
      }
    }
    if (lesson.miniReading) {
      const missing = uniqueLetters(lesson.miniReading.cyrillic, index.letterByChar).filter((l) => !known.has(l));
      if (missing.length) err(where, `mini reading uses letters not taught yet: ${missing.join(', ')}`);
    }
    if (lesson.words.length < MIN_WORDS_PER_LESSON) {
      warn(where, `only ${lesson.words.length} words (aim for ${MIN_WORDS_PER_LESSON})`);
    }
  }

  for (const l of bundle.letters) {
    if (l.tracks.includes('tg') && l.category !== 'russianOnly' && !taughtIn.has(l.id)) {
      warn(`letter "${l.id}"`, 'is not taught by any lesson');
    }
  }
  const review = bundle.words.filter((w) => w.needsReview).length;
  if (review) warn('words', `${review} word(s) marked needsReview`);
  return issues;
}
