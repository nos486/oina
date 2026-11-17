import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { MIN_PASSWORD_LENGTH } from '@oina/shared';
import { auth, ApiCallError, isAdmin, useSession } from '../lib/auth';
import { signOut, useSyncState, type SyncState } from '../lib/sync';
import { Button, Card } from './ui';

const SYNC_LABEL: Record<SyncState, string> = {
  off: '',
  syncing: 'در حال ذخیره…',
  pending: 'تغییرها به‌زودی ذخیره می‌شوند',
  synced: 'پیشرفت در حساب ذخیره شده ✓',
  error: 'ذخیره نشد؛ وقتی اینترنت وصل شد دوباره تلاش می‌کند',
};

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) return setMsg({ ok: false, text: `رمز تازه حداقل ${MIN_PASSWORD_LENGTH} حرف باشد.` });
    try {
      await auth.changePassword(current, next);
      setMsg({ ok: true, text: 'رمز عوض شد.' });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMsg({ ok: false, text: err instanceof ApiCallError && err.status === 403 ? 'رمز فعلی درست نیست.' : 'رمز عوض نشد.' });
    }
  };
  const field = 'mt-1 w-full rounded-xl border-2 border-line bg-surface px-3 py-2';
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>تغییر رمز</Button>;
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3">
      <label>رمز فعلی<input className={field} dir="ltr" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
      <label>رمز تازه<input className={field} dir="ltr" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
      {msg && <p role="status" className={msg.ok ? 'text-good' : 'text-bad'}>{msg.text}</p>}
      <Button type="submit">ذخیره‌ی رمز تازه</Button>
    </form>
  );
}

export function AccountCard() {
  const session = useSession();
  const { state } = useSyncState();
  return (
    <Card className="mb-4">
      <h2 className="mb-2 text-lg font-bold">حساب کاربری</h2>
      {session ? (
        <div className="flex flex-col gap-2">
          <p>
            وارد شده‌ای با نام <b dir="ltr">{session.user.name}</b>
            {isAdmin(session) && <span className="ms-2 rounded-full bg-cat-tajik px-2 py-0.5 text-xs font-bold text-white">مدیر</span>}
          </p>
          {state !== 'off' && <p className={`text-sm ${state === 'error' ? 'text-bad' : 'text-muted'}`} role="status">{SYNC_LABEL[state]}</p>}
          {isAdmin(session) && <Link to="/admin" className="font-semibold text-primary">صفحه‌ی مدیریت ←</Link>}
          <ChangePassword />
          <Button variant="secondary" onClick={() => void signOut()}>خروج از حساب</Button>
          <p className="text-xs text-muted">با خروج، پیشرفت این دستگاه پاک می‌شود ولی در حسابت می‌ماند.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">با حساب، پیشرفتت در سرور ذخیره می‌شود و روی هر دستگاهی ادامه می‌دهی.</p>
          <Link to="/login" className="min-h-12 rounded-2xl border-2 border-b-4 border-black/15 bg-primary px-5 py-3 text-center font-bold text-primary-ink">ورود یا ساخت حساب</Link>
        </div>
      )}
    </Card>
  );
}
