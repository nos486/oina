import { promptInstall, useInstallState } from '../lib/pwa';
import { Button, Card } from './ui';

/** Offers to put the app on the home screen; it then opens full screen and works offline. */
export function InstallCard() {
  const state = useInstallState();
  if (state === 'installed' || state === 'unavailable') return null;
  return (
    <Card className="mb-4">
      <h2 className="mb-1 text-lg font-bold">📲 آینه روی گوشی</h2>
      <p className="mb-3 text-sm text-muted">آینه را به صفحه‌ی اصلی گوشی اضافه کن تا مثل یک برنامه باز شود و بدون اینترنت هم کار کند.</p>
      {state === 'available' ? (
        <Button className="w-full" onClick={() => void promptInstall()}>نصب روی گوشی</Button>
      ) : (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm">در سافاری دکمه‌ی «اشتراک‌گذاری» را بزن و «Add to Home Screen» را انتخاب کن.</p>
      )}
    </Card>
  );
}
