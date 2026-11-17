import { Page, Card } from '../components/ui';
import { Cyr } from '../components/Cyr';

export function ReadingPage() {
  return (
    <Page title="اتاق مطالعه">
      <Card>
        <p className="mb-2 font-bold">به‌زودی</p>
        <p className="text-muted">
          ضرب‌المثل‌ها، شعر رودکی، مولوی و حافظ و متن‌های ساده‌ی روزمره به خط سیریلیک. با ضربه روی هر کلمه شکل فارسی‌اش را می‌بینی.
        </p>
        <p className="mt-4 text-center text-2xl">
          <Cyr className="font-bold">Бишнав аз най чун ҳикоят мекунад</Cyr>
        </p>
        <p className="text-center text-muted">بشنو از نی چون حکایت می‌کند</p>
      </Card>
    </Page>
  );
}
