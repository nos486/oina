import { describe, expect, it } from 'vitest';
import type { Question } from '../src/index.js';
import {
  answer, checkpoints, checkpointStars, completeCheckpoint, createProgress, createRng, generateCheckpoint, generateExam,
  generatePractice, lettersTaughtThrough, maxStars, mergeProgress, normalizeProgress, pendingCheckpoint, recordExam, startSession,
  totalStars, uniqueLetters,
} from '../src/index.js';
import { T0, realIndex } from './fixtures.js';

const idx = realIndex();

function cyrTexts(q: Question): string[] {
  if (q.type === 'match') return q.pairs.map((p) => p.cyr);
  if (q.type === 'buildWord') return q.tiles.map((t) => t.label);
  return [...(q.prompt.script === 'cyr' ? [q.prompt.text] : []), ...q.options.filter((o) => o.script === 'cyr').map((o) => o.label)];
}

const doneThrough = (lessonId: string) => {
  const order = idx.lessonOrder.map((l) => l.id);
  return { ...createProgress(T0), completedLessons: order.slice(0, order.indexOf(lessonId) + 1) };
};

describe('review checkpoints', () => {
  const cps = checkpoints(idx);

  it('sit after every second lesson of a stage, never right before the stage test', () => {
    expect(cps.length).toBeGreaterThanOrEqual(6);
    for (const cp of cps) {
      const stage = idx.stageById.get(cp.stageId)!;
      const i = stage.lessons.indexOf(cp.afterLessonId);
      expect((i + 1) % 2).toBe(0);
      expect(i).toBeLessThan(stage.lessons.length - 1);
      expect(cp.recentLessonIds).toHaveLength(2);
    }
    // A five-lesson stage gets two.
    const five = idx.stages.find((s) => s.lessons.length === 5)!;
    expect(cps.filter((c) => c.stageId === five.id)).toHaveLength(2);
  });

  it('ask mostly about older lessons and only use letters taught so far', () => {
    for (const cp of cps) {
      const { questions } = generateCheckpoint(idx, doneThrough(cp.afterLessonId), cp, createRng(3), T0);
      expect(questions.length).toBeGreaterThanOrEqual(10);
      const known = lettersTaughtThrough(idx, cp.afterLessonId);
      for (const q of questions) for (const t of cyrTexts(q)) {
        for (const l of uniqueLetters(t, idx.letterByChar)) expect(known.has(l), `${cp.id} "${t}"`).toBe(true);
      }
      if (cp.olderLessonIds.length) {
        const recentKeys = new Set(
          cp.recentLessonIds.flatMap((id) => {
            const l = idx.lessonById.get(id)!;
            return [...l.newLetters.map((x) => `letter:${x}`), ...l.words.map((w) => `word:${w}`)];
          }),
        );
        const older = questions.filter((q) => q.type !== 'match' && !recentKeys.has(q.itemKey)).length;
        expect(older, cp.id).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('stars, pending checkpoint and totals', () => {
    expect(checkpointStars(0.5)).toBe(0);
    expect(checkpointStars(0.6)).toBe(1);
    expect(checkpointStars(1)).toBe(3);
    const cp = cps[0]!;
    let p = doneThrough(cp.afterLessonId);
    expect(pendingCheckpoint(idx, p)?.id).toBe(cp.id);
    p = completeCheckpoint(p, cp.id, 0.85);
    expect(p.reviewStars[cp.id]).toBe(2);
    expect(pendingCheckpoint(idx, p)).toBeUndefined();
    expect(completeCheckpoint(p, cp.id, 0.1).reviewStars[cp.id]).toBe(2);
    expect(totalStars(p)).toBe(2);
    expect(maxStars(idx)).toBe((idx.lessons.length + 6 + cps.length) * 3);
  });
});

describe('practice sets and the exam', () => {
  const p = doneThrough('s3-l2');

  it('practice uses only learned items', () => {
    const known = lettersTaughtThrough(idx, 's3-l2');
    for (const kind of ['letters', 'words', 'mix'] as const) {
      const { questions } = generatePractice(idx, p, kind, createRng(5), T0);
      expect(questions.length, kind).toBeGreaterThanOrEqual(10);
      for (const q of questions) for (const t of cyrTexts(q)) {
        for (const l of uniqueLetters(t, idx.letterByChar)) expect(known.has(l), `${kind} "${t}"`).toBe(true);
      }
      if (kind === 'letters') expect(questions.every((q) => q.itemKey.startsWith('letter:'))).toBe(true);
    }
    const stage = generatePractice(idx, p, 'stage', createRng(5), T0, { stageId: 2 });
    const stage2 = new Set(idx.stageById.get(2)!.lessons.flatMap((id) => {
      const l = idx.lessonById.get(id)!;
      return [...l.newLetters.map((x) => `letter:${x}`), ...l.words.map((w) => `word:${w}`)];
    }));
    expect(stage.questions.filter((q) => q.type !== 'match').every((q) => stage2.has(q.itemKey))).toBe(true);
  });

  it('the exam covers every finished stage and never repeats a question', () => {
    const { questions, ctx } = generateExam(idx, p, createRng(9));
    expect(questions).toHaveLength(20);
    const stagesHit = new Set(
      questions.map((q) => idx.lessonOrder.find((l) => l.newLetters.some((x) => q.itemKey === `letter:${x}`) || l.words.some((w) => q.itemKey === `word:${w}`))!.stageId),
    );
    expect(stagesHit).toEqual(new Set([1, 2, 3]));
    let s = startSession('exam', questions, 2);
    for (const q of questions) {
      const r = q.type === 'buildWord' ? { type: 'build' as const, labels: ['x'] } : q.type === 'match' ? { type: 'match' as const, wrongPairs: [] } : { type: 'choice' as const, optionId: 'nope' };
      s = answer(s, r, ctx).state;
    }
    expect(s.done).toBe(true);
    expect(s.queue).toHaveLength(20);
  });

  it('exam history is kept, normalized and merged', () => {
    let a = recordExam(createProgress(T0), { at: '2026-11-20T10:00:00Z', correct: 15, total: 20 });
    const b = recordExam(createProgress(T0), { at: '2026-11-21T10:00:00Z', correct: 18, total: 20 });
    a = mergeProgress(a, b);
    expect(a.exams.map((e) => e.at)).toEqual(['2026-11-21T10:00:00Z', '2026-11-20T10:00:00Z']);
    const n = normalizeProgress({ version: 1, exams: [{ at: 'x', correct: 1, total: 0 }, { at: 'y', correct: 2, total: 4, extra: 1 }], reviewStars: { a: 2 } }, T0);
    expect(n.exams).toEqual([{ at: 'y', correct: 2, total: 4 }]);
    expect(n.reviewStars).toEqual({ a: 2 });
  });
});
