import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { auth, AuthError } from '../lib/auth';
import { Button, Card, Page } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await auth.login(username, password);
      navigate(user.roles.includes('admin') ? '/admin' : '/tools', { replace: true });
    } catch (err) {
      setError(err instanceof AuthError && err.status === 401 ? 'نام کاربری یا رمز درست نیست.' : 'اتصال به سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full rounded-xl border-2 border-line bg-surface px-3 py-3 text-base';
  return (
    <Page title="ورود">
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label>
            نام کاربری
            <input className={field} dir="ltr" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label>
            رمز عبور
            <input className={field} dir="ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert" className="font-semibold text-bad">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'در حال ورود…' : 'ورود'}</Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          ورود اختیاری است و فعلاً برای تست است؛ برنامه بدون حساب هم کار می‌کند. ورود با گوگل بعداً اضافه می‌شود.
        </p>
      </Card>
    </Page>
  );
}
