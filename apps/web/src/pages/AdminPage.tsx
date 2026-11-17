import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { AdminStats } from '@oina/shared';
import { auth, isAdmin, useSession } from '../lib/auth';
import { Card, Page } from '../components/ui';
import { Cyr } from '../components/Cyr';
import { n } from '../lib/format';

/** Admin overview: content numbers and the words still waiting for a Tajik speaker's check. */
export function AdminPage() {
  const session = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [defaultPassword, setDefaultPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin(session)) return;
    auth.adminStats().then(setStats).catch(() => setError('آمار بارگیری نشد.'));
    auth.me().then((m) => setDefaultPassword(m.defaultPassword)).catch(() => undefined);
  }, [session]);

  if (!isAdmin(session)) {
    return (
      <Page title="مدیریت">
        <p className="mb-3">این صفحه فقط برای مدیر است.</p>
        <Link to="/login" className="font-semibold text-primary">ورود</Link>
      </Page>
    );
  }

  return (
    <Page title="مدیریت">
      {defaultPassword && (
        <Card className="mb-4 border-bad bg-bad-soft">
          <p className="font-bold text-bad">رمز پیش‌فرض (admin) هنوز فعال است.</p>
          <p className="text-sm">
            قبل از اشتراک‌گذاری سایت رمز را عوض کن: <Link to="/tools" className="font-semibold text-primary">ابزار ← حساب کاربری ← تغییر رمز</Link>
          </p>
        </Card>
      )}
      {error && <p role="alert" className="mb-4 text-bad">{error}</p>}
      {stats && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[
              ['حرف', stats.letters],
              ['کلمه', stats.words],
              ['درس', stats.lessons],
              ['فایل صوتی', stats.audioFiles],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <div className="text-2xl font-extrabold">{n(value as number)}</div>
                <div className="text-sm text-muted">{label}</div>
              </Card>
            ))}
          </div>
          <Card className="mb-4">
            <h2 className="mb-3 text-lg font-bold">کاربران ({n(stats.users ?? 0)})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted">
                  <tr><th className="py-1 text-start">نام کاربری</th><th className="text-start">درس</th><th className="text-start">امتیاز</th><th className="text-start">آخرین ذخیره</th></tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="py-2" dir="ltr">{u.username ?? u.name}{u.roles.includes('admin') ? ' ★' : ''}</td>
                      <td>{n(u.lessons)}</td>
                      <td>{n(u.xp)}</td>
                      <td className="text-muted">{u.lastProgressAt ? new Date(u.lastProgressAt).toLocaleDateString('fa-IR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2 className="mb-1 text-lg font-bold">کلمه‌هایی که بازبینی می‌خواهند ({n(stats.needsReview.length)})</h2>
            <p className="mb-3 text-sm text-muted">املای تاجیکی این‌ها باید توسط یک تاجیک‌زبان تأیید شود (content/words.json، فیلد needsReview).</p>
            <ul className="grid grid-cols-2 gap-2">
              {stats.needsReview.map((w) => (
                <li key={w.id} className="rounded-xl bg-surface-2 px-3 py-2">
                  <Cyr className="font-bold">{w.cyrillic}</Cyr> = {w.persian}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted" dir="ltr">content {stats.contentVersion}</p>
          </Card>
        </>
      )}
    </Page>
  );
}
