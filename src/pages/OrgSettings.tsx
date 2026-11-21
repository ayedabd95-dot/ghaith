import { useState } from 'react';
import { Settings, BadgeCheck } from 'lucide-react';
import { supabase, errText, type Org } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PLAN, dateAr, money, GOVERNORATES } from '../lib/format';
import { PageHeader, Field, useToast } from '../components/ui';

export default function OrgSettings() {
  const { org, setOrg } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ name: org!.name, tagline: org!.tagline ?? '', governorate: org!.governorate ?? 'بغداد', contact_phone: org!.contact_phone ?? '', approval_threshold: String(org!.approval_threshold) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (v.name.trim().length < 3) return setErr('اكتب اسم المؤسسة');
    const thr = Number(v.approval_threshold.replace(/[^\d]/g, ''));
    setBusy(true);
    const { data, error } = await supabase.from('ch_orgs').update({
      name: v.name.trim(), tagline: v.tagline.trim() || null, governorate: v.governorate, contact_phone: v.contact_phone.replace(/\s/g, '') || null, approval_threshold: thr,
    }).eq('id', org!.id).select('*').single();
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    setOrg(data as Org);
    toast({ kind: 'ok', text: 'انحفظت إعدادات المؤسسة' });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="إعدادات المؤسسة" icon={Settings} />
      <div className="card p-5 mb-4 flex items-center gap-4 bg-brand-50 border-brand-100">
        <BadgeCheck className="size-10 text-brand-700 shrink-0" />
        <div>
          <div className="font-bold">اشتراك منصة غيث — باقة {PLAN[org!.plan]}</div>
          <div className="text-sm text-ink-700">{org!.subscription_ends ? <>فعّال لحد <b>{dateAr(org!.subscription_ends)}</b>. للتجديد تواصل ويا إدارة المنصة.</> : 'اشتراك مفتوح.'}</div>
        </div>
      </div>
      <form onSubmit={save} className="card p-5 space-y-4" noValidate>
        <Field label="اسم المؤسسة" required hint="يطلع بالواجهة والوصولات وبطاقات العوائل"><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="وصف قصير"><input className="input" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="المحافظة"><select className="input" value={v.governorate} onChange={(e) => setV({ ...v, governorate: e.target.value })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="هاتف المؤسسة"><input className="input text-left" dir="ltr" inputMode="tel" value={v.contact_phone} onChange={(e) => setV({ ...v, contact_phone: e.target.value })} /></Field>
        </div>
        <Field label="حد الموافقة على المصروفات (د.ع)" hint={`أي مصروف أكثر من ${money(Number(v.approval_threshold.replace(/[^\d]/g, '')))} يحتاج موافقتك`}>
          <input className="input text-left" dir="ltr" inputMode="numeric" value={v.approval_threshold} onChange={(e) => setV({ ...v, approval_threshold: e.target.value })} />
        </Field>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button>
      </form>
    </div>
  );
}
