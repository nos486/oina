import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { MIN_PASSWORD_LENGTH } from '@oina/shared';
import { auth, ApiCallError } from '../lib/auth';
import { onSignedIn } from '../lib/sync';
import { progressStore } from '../state/progress';
import { Button, Card, Page } from '../components/ui';

const ERRORS: Record<number, string> = {
  401: 'نام کاربری یا رمز درست نیست.',
  409: 'این نام کاربری قبلاً گرفته شده.',
  503: 'سرور هنوز به پایگاه داده وصل نیست.',
};

export function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = mode === 'login' ? await auth.login(username, password) : await auth.register(username, password);
      await onSignedIn();
      progressStore.update((p) => (p.onboarded ? p : { ...p, onboarded: true }));
      navigate(user.roles.includes('admin') ? '/admin' : '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiCallError && err.status === 400) {
        setError(mode === 'register' ? `نام کاربری ۳ تا ۳۲ حرف انگلیسی/عدد، رمز حداقل ${MIN_PASSWORD_LENGTH} حرف.` : 'نام کاربری و رمز را وارد کن.');
      } else setError(err instanceof ApiCallError ? (ERRORS[err.status] ?? 'خطایی پیش آمد.') : 'اتصال به سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full rounded-xl border-2 border-line bg-surface px-3 py-3 text-base';
  const tab = (active: boolean) => `flex-1 rounded-xl py-2 font-bold ${active ? 'bg-primary text-primary-ink' : 'text-muted'}`;
  return (
    <Page title={mode === 'login' ? 'ورود' : 'ساخت حساب'}>
      <Card>
        <div className="mb-4 flex gap-2 rounded-2xl bg-surface-2 p-1" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={tab(mode === 'login')} onClick={() => setMode('login')}>ورود</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={tab(mode === 'register')} onClick={() => setMode('register')}>ساخت حساب</button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label>
            نام کاربری
            <input className={field} dir="ltr" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            رمز عبور
            <input className={field} dir="ltr" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert" className="font-semibold text-bad">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'صبر کن…' : mode === 'login' ? 'ورود' : 'ساخت حساب'}</Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          با حساب، پیشرفتت (درس‌ها، ستاره‌ها، امتیاز و مرورها) در سرور ذخیره می‌شود و روی هر دستگاهی ادامه می‌دهی. بدون حساب هم برنامه کار می‌کند. ورود با گوگل بعداً اضافه می‌شود.
        </p>
      </Card>
    </Page>
  );
}
