import { useRef, useState } from 'react';
import type { DailyGoal, Settings } from '@oina/shared';
import { BADGES, levelInfo, maxStars, totalStars } from '@oina/engine';
import { useContent } from '../state/content';
import { progressStore, useProgress } from '../state/progress';
import { AccountCard } from '../components/AccountCard';
import { Button, Card, Page, ProgressBar } from '../components/ui';
import { n } from '../lib/format';

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3">
      <span>{label}</span>
      <input type="checkbox" className="h-6 w-6 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ToolsPage() {
  const p = useProgress();
  const index = useContent();
  const lvl = levelInfo(p.xp);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Settings>) => progressStore.update((x) => ({ ...x, settings: { ...x.settings, ...patch } }));

  const exportFile = () => {
    const blob = new Blob([progressStore.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `oina-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page title="ابزار و تنظیمات">
      <AccountCard />

      <Card className="mb-4">
        <h2 className="mb-1 text-lg font-bold">مبدل سیریلیک ← فارسی</h2>
        <p className="text-muted">به‌زودی (نسخه‌ی ۱٫۱)</p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-lg font-bold">تنظیمات</h2>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>هدف روزانه</span>
          <select className="rounded-xl border-2 border-line bg-surface px-3 py-2" value={p.dailyGoal} onChange={(e) => progressStore.update((x) => ({ ...x, dailyGoal: Number(e.target.value) as DailyGoal }))}>
            <option value={20}>{n(20)} امتیاز</option>
            <option value={50}>{n(50)} امتیاز</option>
            <option value={100}>{n(100)} امتیاز</option>
          </select>
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>حالت نمایش</span>
          <select className="rounded-xl border-2 border-line bg-surface px-3 py-2" value={p.settings.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
            <option value="system">مثل دستگاه</option>
            <option value="light">روشن</option>
            <option value="dark">تیره</option>
          </select>
        </label>
        <label className="flex min-h-12 items-center justify-between gap-3">
          <span>اندازه‌ی قلم</span>
          <input type="range" min={0.875} max={1.375} step={0.125} value={p.settings.fontScale} onChange={(e) => set({ fontScale: Number(e.target.value) })} className="accent-[var(--primary)]" />
        </label>
        <Toggle label="صدا" checked={p.settings.sound} onChange={(v) => set({ sound: v })} />
        <Toggle label="جان (قلب)" checked={p.settings.hearts} onChange={(v) => set({ hearts: v })} />
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-lg font-bold">پیشرفت من</h2>
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-2xl font-extrabold text-primary">{n(lvl.level)}</div><div className="text-xs text-muted">سطح</div></div>
          <div><div className="text-2xl font-extrabold text-gold">{n(totalStars(p))}</div><div className="text-xs text-muted">ستاره از {n(maxStars(index))}</div></div>
          <div><div className="text-2xl font-extrabold">{n(p.xp)}</div><div className="text-xs text-muted">امتیاز</div></div>
        </div>
        <ProgressBar value={lvl.fraction} />
        <p className="mt-1 text-xs text-muted">{n(lvl.next - p.xp)} امتیاز تا سطح {n(lvl.level + 1)}</p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-lg font-bold">نشان‌ها</h2>
        <ul className="grid grid-cols-2 gap-2">
          {BADGES.map((b) => {
            const has = p.badges.includes(b.id);
            return (
              <li key={b.id} className={`rounded-2xl border-2 border-line p-3 ${has ? '' : 'opacity-40'}`}>
                <p className="font-bold">{has ? '🏅' : '🔒'} {b.titleFa}</p>
                <p className="text-xs text-muted">{b.descriptionFa}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-bold">پیشرفت</h2>
        <p className="mb-3 text-sm text-muted">پیشرفتت فقط در همین مرورگر ذخیره می‌شود. برای انتقال به دستگاه دیگر، خروجی بگیر و آنجا وارد کن.</p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={exportFile}>خروجی JSON</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>ورود از JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setMsg(progressStore.importJson(await f.text()) ? 'پیشرفت وارد شد.' : 'این فایل معتبر نیست.');
              e.target.value = '';
            }}
          />
          <Button
            variant="bad"
            onClick={() => {
              if (window.confirm('همه‌ی پیشرفت این دستگاه پاک شود؟ این کار برگشت ندارد.')) {
                progressStore.reset();
                setMsg('پیشرفت پاک شد.');
              }
            }}
          >
            پاک کردن پیشرفت
          </Button>
          {msg && <p role="status" className="text-sm font-semibold">{msg}</p>}
        </div>
      </Card>
      <p className="mt-6 text-center text-xs text-muted">آینه · Оина — فارسی را با خطی دیگر بخوان</p>
    </Page>
  );
}
