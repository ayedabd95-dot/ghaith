import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronRight } from 'lucide-react';
import { supabase, errText, type Fund } from '../lib/supabase';
import { METHOD, PURPOSE, money } from '../lib/format';
import { useLoad, Field, useToast } from '../components/ui';

const METHOD_FUND: Record<string, string> = { cash: 'cash', zaincash: 'zaincash', bank: 'bank', in_kind: 'cash' };

export default function DonationForm() {
  const nav = useNavigate();
  const toast = useToast();
  const { data: funds } = useLoad(async () => ((await supabase.from('ch_fund_balances').select('*')).data ?? []) as Fund[]);
  const { data: camps } = useLoad(async () => (await supabase.from('ch_campaigns').select('id,name').eq('status', 'active')).data ?? []);
  const [v, setV] = useState({ donor_name: '', donor_phone: '', amount: '', currency: 'IQD', rate: '1310', method: 'cash', fund_id: '', purpose: 'general', campaign_id: '', txn_ref: '', notes: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof v, val: string) => { setV((x) => ({ ...x, [k]: val })); setErrs((e) => ({ ...e, [k]: '' })); };

  const fundFor = (method: string) => funds?.find((f) => f.kind === METHOD_FUND[method])?.id ?? '';
  const fundId = v.fund_id || fundFor(v.method);
  const amount = Number(v.amount.replace(/[^\d.]/g, ''));
  const iqd = v.currency === 'USD' ? amount * Number(v.rate || 0) : amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!amount || amount <= 0) er.amount = 'اكتب المبلغ';
    if (v.currency === 'USD' && !(Number(v.rate) > 0)) er.rate = 'اكتب سعر الصرف';
    if ((v.method === 'zaincash' || v.method === 'bank') && !v.txn_ref.trim()) er.txn_ref = 'اكتب رقم العملية حتى نكدر نطابقها';
    if (v.donor_phone && !/^07\d{9}$/.test(v.donor_phone.replace(/\s/g, ''))) er.donor_phone = 'رقم الهاتف لازم 11 رقم ويبدأ بـ 07';
    if (v.purpose === 'campaign' && !v.campaign_id) er.campaign_id = 'اختار الحملة';
    setErrs(er);
    if (Object.values(er).some(Boolean)) return;
    setBusy(true);
    const { data, error } = await supabase.from('ch_donations').insert({
      donor_name: v.donor_name.trim() || 'فاعل خير', donor_phone: v.donor_phone.replace(/\s/g, '') || null, amount, currency: v.currency,
      rate: v.currency === 'USD' ? Number(v.rate) : 1, method: v.method, fund_id: fundId, purpose: v.purpose,
      campaign_id: v.purpose === 'campaign' ? v.campaign_id : null, txn_ref: v.txn_ref.trim() || null, notes: v.notes.trim() || null,
    }).select('id').single();
    setBusy(false);
    if (error) { toast({ kind: 'err', text: errText(error) }); return; }
    toast({ kind: 'ok', text: 'انسجل التبرع وطلع الوصل' });
    nav(`/finance/receipt/${data.id}`, { replace: true });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto" noValidate>
      <div className="flex items-center gap-3 mb-5">
        <button type="button" className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><Receipt className="size-6" /></span>
        <h1 className="text-xl font-bold">تسجيل تبرع</h1>
      </div>
      <div className="card p-4 lg:p-5 space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="المبلغ" required error={errs.amount}>
            <input className="input text-left text-xl font-bold h-14" dir="ltr" inputMode="decimal" value={v.amount} onChange={(e) => up('amount', e.target.value)} placeholder="0" autoFocus />
          </Field>
          <Field label="العملة">
            <select className="input h-14 w-28" value={v.currency} onChange={(e) => up('currency', e.target.value)}><option value="IQD">دينار</option><option value="USD">دولار</option></select>
          </Field>
        </div>
        {v.currency === 'USD' && (
          <Field label="سعر صرف الدولار اليوم (دينار)" required error={errs.rate} hint={`يعادل ${money(iqd)}`}>
            <input className="input text-left" dir="ltr" inputMode="numeric" value={v.rate} onChange={(e) => up('rate', e.target.value)} />
          </Field>
        )}
        <div>
          <span className="field-label">طريقة التبرع</span>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(METHOD).map(([k, l]) => (
              <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 h-12 cursor-pointer ${v.method === k ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200'}`}>
                <input type="radio" name="method" className="size-5 accent-brand-700" checked={v.method === k} onChange={() => { up('method', k); up('fund_id', ''); }} />{l}
              </label>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="الصندوق">
            <select className="input" value={fundId} onChange={(e) => up('fund_id', e.target.value)}>{funds?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          </Field>
          <Field label="الغرض">
            <select className="input" value={v.purpose} onChange={(e) => up('purpose', e.target.value)}>{Object.entries(PURPOSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          {v.purpose === 'campaign' && (
            <Field label="الحملة" required error={errs.campaign_id}>
              <select className="input" value={v.campaign_id} onChange={(e) => up('campaign_id', e.target.value)}><option value="">اختار…</option>{camps?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
          )}
          {(v.method === 'zaincash' || v.method === 'bank') && (
            <Field label="رقم العملية / الحوالة" required error={errs.txn_ref}><input className="input text-left" dir="ltr" value={v.txn_ref} onChange={(e) => up('txn_ref', e.target.value)} /></Field>
          )}
          <Field label="اسم المتبرع" hint="اتركه فارغ إذا يريد يبقى «فاعل خير»"><input className="input" value={v.donor_name} onChange={(e) => up('donor_name', e.target.value)} /></Field>
          <Field label="هاتف المتبرع" error={errs.donor_phone} hint="حتى نبعثله الوصل بالواتساب"><input className="input text-left" dir="ltr" inputMode="tel" value={v.donor_phone} onChange={(e) => up('donor_phone', e.target.value)} /></Field>
        </div>
        <Field label="ملاحظات"><textarea className="input" rows={2} value={v.notes} onChange={(e) => up('notes', e.target.value)} /></Field>
      </div>
      <button className="btn-primary w-full h-12 mt-4" disabled={busy}>{busy ? 'جاري الحفظ…' : `حفظ وإصدار الوصل${iqd ? ` — ${money(iqd)}` : ''}`}</button>
    </form>
  );
}
