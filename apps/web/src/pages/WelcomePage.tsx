import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { DailyGoal } from '@oina/shared';
import { progressStore } from '../state/progress';
import { Button, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { Hoopoe } from '../components/Hoopoe';
import { n } from '../lib/format';

const WORD = 'Тоҷикистон';
const FA = 'تاجیکستان';

/** First run: one live example that turns letter by letter into Persian, then goal choice. */
export function WelcomePage() {
  const navigate = useNavigate();
  const [shown, setShown] = useState(0);
  const [goal, setGoal] = useState<DailyGoal>(20);

  useEffect(() => {
    if (shown >= WORD.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 280);
    return () => clearTimeout(t);
  }, [shown]);

  const start = () => {
    progressStore.update((p) => ({ ...p, onboarded: true, dailyGoal: goal }));
    navigate('/lesson/s1-l1', { replace: true });
  };

  const choice = (active: boolean) => `min-h-12 rounded-2xl border-2 border-b-4 px-3 py-2 font-bold ${active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`;

  return (
    <Page>
      <div className="flex flex-col items-center gap-4 pt-6 text-center">
        <Hoopoe size={96} />
        <h1 className="text-3xl font-extrabold">آینه</h1>
        <p className="text-lg">فارسی را با خطی دیگر بخوان</p>
        <div className="my-4 w-full rounded-3xl bg-surface-2 p-6">
          <p className="mb-2 text-muted">این را می‌توانی بخوانی؟</p>
          <Cyr className="text-4xl font-bold">
            {[...WORD].map((ch, i) => (
              <span key={i} className={i < shown ? 'text-primary' : ''}>{ch}</span>
            ))}
          </Cyr>
          <p className="mt-2 h-10 text-3xl font-extrabold">{shown >= WORD.length ? FA : ''}</p>
        </div>
        <div className="w-full text-start">
          <p className="mb-2 text-muted">
            تاجیکی همان فارسی است، فقط با خط سیریلیک نوشته می‌شود. اینجا زبان تازه یاد نمی‌گیری؛ فقط خواندن این خط را یاد می‌گیری.
          </p>
          <p className="mt-4 mb-2 font-bold">هدف روزانه</p>
          <div className="grid grid-cols-3 gap-2">
            {([20, 50, 100] as const).map((g) => (
              <button key={g} type="button" className={choice(goal === g)} onClick={() => setGoal(g)}>{n(g)} امتیاز</button>
            ))}
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={start}>شروع کنیم</Button>
        <Link to="/login" className="font-semibold text-primary">حساب داری؟ وارد شو</Link>
      </div>
    </Page>
  );
}
