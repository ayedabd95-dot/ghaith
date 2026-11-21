import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logoUrl, assetUrl, DEFAULT_LOGO } from '../lib/logo';
import { dmy } from '../lib/format';

interface Result {
  status: 'valid' | 'expired' | 'revoked' | 'org_suspended' | 'not_issued';
  full_name: string; full_name_en: string | null; position: string | null; position_en: string | null;
  id_number: string | null; photo_path: string | null; card_issued: string | null; card_expires: string | null;
  org_name: string; org_name_en: string | null; org_logo: string | null;
}

const STATE = {
  valid: { icon: ShieldCheck, ar: 'بطاقة صحيحة وسارية', en: 'Valid card', cls: 'bg-brand-700' },
  expired: { icon: ShieldAlert, ar: 'البطاقة منتهية الصلاحية', en: 'Card expired', cls: 'bg-amber-600' },
  revoked: { icon: ShieldX, ar: 'البطاقة ملغاة', en: 'Card revoked', cls: 'bg-red-700' },
  org_suspended: { icon: ShieldX, ar: 'الجهة المصدرة غير فعّالة', en: 'Issuer inactive', cls: 'bg-red-700' },
  not_issued: { icon: ShieldX, ar: 'البطاقة غير صادرة', en: 'Card not issued', cls: 'bg-red-700' },
} as const;

/** Public page opened by scanning the verify code on the back of a card. */
export default function Verify() {
  const { token } = useParams();
  const [r, setR] = useState<Result | null | 'missing'>(null);
  useEffect(() => {
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) { setR('missing'); return; }
    supabase.rpc('ch_verify_card', { t: token }).then(({ data }) => setR((data as Result) ?? 'missing'));
  }, [token]);

  if (r === null) return <div className="min-h-full grid place-items-center text-ink-500">جاري التحقق… Verifying…</div>;
  if (r === 'missing') {
    return (
      <div className="min-h-full grid place-items-center p-6 bg-ink-50">
        <div className="card max-w-sm w-full p-8 text-center">
          <ShieldX className="size-14 text-red-700 mx-auto" />
          <h1 className="text-xl font-bold mt-3">بطاقة غير معروفة</h1>
          <p className="text-ink-500 mt-1" dir="ltr">Unknown card</p>
          <p className="text-sm text-ink-700 mt-4 leading-6">هذا الرمز مو صادر من أي مؤسسة على منصة غيث. البطاقة ممكن تكون مزوّرة.</p>
          <img src={DEFAULT_LOGO} alt="" className="size-10 rounded-xl mx-auto mt-6" />
        </div>
      </div>
    );
  }
  const st = STATE[r.status];
  const photo = assetUrl('ch-ids', r.photo_path);
  return (
    <div className="min-h-full grid place-items-center p-4 bg-ink-50">
      <div className="card max-w-sm w-full overflow-hidden">
        <div className={`${st.cls} text-white px-5 py-4 flex items-center gap-3`}>
          <st.icon className="size-9 shrink-0" />
          <div><div className="font-bold text-lg">{st.ar}</div><div className="text-sm opacity-90" dir="ltr">{st.en}</div></div>
        </div>
        <div className="p-5">
          <div className="flex items-center gap-2 text-sm text-ink-700 mb-4">
            <img src={logoUrl(r.org_logo)} alt="" className="size-8 rounded-lg object-contain" />
            <div><div className="font-bold">{r.org_name}</div>{r.org_name_en && <div className="text-xs text-ink-500" dir="ltr">{r.org_name_en}</div>}</div>
          </div>
          <div className="flex gap-4">
            <div className="w-24 h-32 rounded-xl overflow-hidden bg-ink-100 shrink-0 ring-2 ring-gold-500">
              {photo ? <img src={photo} alt="صورة حامل البطاقة" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-3xl font-bold text-ink-500">{r.full_name.charAt(0)}</div>}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg leading-7">{r.full_name}</div>
              {r.full_name_en && <div className="text-sm text-ink-500" dir="ltr">{r.full_name_en}</div>}
              <div className="text-sm mt-2">{r.position}</div>
              {r.position_en && <div className="text-xs text-ink-500" dir="ltr">{r.position_en}</div>}
            </div>
          </div>
          <dl className="mt-4 divide-y divide-ink-100 text-sm">
            <div className="flex justify-between py-2"><dt className="text-ink-500">رقم البطاقة · ID No.</dt><dd className="font-bold num">{r.id_number ?? '—'}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-500">الإصدار · Issued</dt><dd className="num">{dmy(r.card_issued)}</dd></div>
            <div className="flex justify-between py-2"><dt className="text-ink-500">النفاذ · Expires</dt><dd className="num">{dmy(r.card_expires)}</dd></div>
          </dl>
          <p className="text-xs text-ink-500 mt-4 leading-5">قارن الصورة والاسم هنا ويا البطاقة اللي بيدك. إذا ما يطابقون، البطاقة مزوّرة. · Compare this photo and name with the physical card.</p>
        </div>
        <div className="bg-ink-50 px-5 py-3 text-xs text-ink-500 flex items-center gap-2"><img src={DEFAULT_LOGO} alt="" className="size-5 rounded" />تحقق رسمي عبر منصة غيث · Verified by Ghaith</div>
      </div>
    </div>
  );
}
