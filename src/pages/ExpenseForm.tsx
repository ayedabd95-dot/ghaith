import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCart, ChevronRight, Camera, X } from 'lucide-react';
import { supabase, errText, type Fund } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { EXPENSE_KIND, PURPOSE, money } from '../lib/format';
import { useLoad, Field, useToast } from '../components/ui';

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' };

export default function ExpenseForm() {
  const nav = useNavigate();
  const toast = useToast();
  const { can, org } = useAuth();
  const [sp] = useSearchParams();
  const presetFamily = sp.get('family') ?? '';
  const { data } = useLoad(async () => {
    const [f, fam, c] = await Promise.all([
      supabase.from('ch_fund_balances').select('*'),
      presetFamily ? supabase.from('ch_families').select('id,head_name').eq('id', presetFamily).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('ch_campaigns').select('id,name').eq('status', 'active'),
    ]);
    return { funds: (f.data ?? []) as Fund[], threshold: Number(org?.approval_threshold ?? 0), family: fam.data as { id: string; head_name: string } | null, camps: c.data ?? [] };
  });
  const [v, setV] = useState({ amount: '', kind: presetFamily ? 'cash_aid' : 'food', description: '', fund_id: '', purpose: 'general', vendor: '', campaign_id: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const up = (k: keyof typeof v, val: string) => { setV((x) => ({ ...x, [k]: val })); setErrs((e) => ({ ...e, [k]: '' })); };

  const amount = Number(v.amount.replace(/[^\d]/g, ''));
  const fund = data?.funds.find((f) => f.id === v.fund_id);
  const needsApproval = !can('admin') && amount > (data?.threshold ?? 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!amount) er.amount = 'اكتب المبلغ';
    if (!v.description.trim()) er.description = 'اكتب شنو انصرف';
    if (!v.fund_id) er.fund_id = 'اختار الصندوق';
    else if (fund && Number(fund.balance) < amount && !needsApproval) er.fund_id = `الرصيد ما يكفي (المتوفر ${money(fund.balance)})`;
    if (!file && v.kind !== 'cash_aid') er.file = 'صوّر الفاتورة — هي دليل الصرف قدام المتبرعين';
    setErrs(er);
    if (Object.values(er).some(Boolean)) return;
    setBusy(true);
    try {
      let invoice_path: string | null = null;
      if (file) {
        const ext = ALLOWED[file.type];
        invoice_path = `${org!.id}/${new Date().getFullYear()}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('ch-invoices').upload(invoice_path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
      }
      const { data: row, error } = await supabase.from('ch_expenses').insert({
        amount_iqd: amount, kind: v.kind, description: v.description.trim(), fund_id: v.fund_id, purpose: v.purpose,
        vendor: v.vendor.trim() || null, invoice_path, family_id: presetFamily || null, campaign_id: v.campaign_id || null,
      }).select('status').single();
      if (error) throw error;
      toast({ kind: 'ok', text: row.status === 'pending' ? 'انسجل المصروف وراح للمدير للموافقة' : 'انسجل المصروف وانخصم من الصندوق' });
      nav(presetFamily ? `/families/${presetFamily}` : '/finance?tab=expenses', { replace: true });
    } catch (err) { toast({ kind: 'err', text: errText(err) }); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto" noValidate>
      <div className="flex items-center gap-3 mb-5">
        <button type="button" className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <span className="size-11 rounded-xl bg-gold-100 text-gold-700 grid place-items-center"><ShoppingCart className="size-6" /></span>
        <div><h1 className="text-xl font-bold">تسجيل مصروف</h1>{data?.family && <p className="text-sm text-ink-500">مساعدة لعائلة: {data.family.head_name}</p>}</div>
      </div>
      <div className="card p-4 lg:p-5 space-y-4">
        <Field label="المبلغ (د.ع)" required error={errs.amount}>
          <input className="input text-left text-xl font-bold h-14" dir="ltr" inputMode="numeric" value={v.amount} onChange={(e) => up('amount', e.target.value)} placeholder="0" autoFocus />
        </Field>
        {needsApproval && amount > 0 && <div className="rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm font-medium">المبلغ أكثر من {money(data?.threshold)} — راح يحتاج موافقة المدير قبل ما ينخصم.</div>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="نوع المصروف">
            <select className="input" value={v.kind} onChange={(e) => up('kind', e.target.value)}>{Object.entries(EXPENSE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          <Field label="من أي صندوق" required error={errs.fund_id}>
            <select className="input" value={v.fund_id} onChange={(e) => up('fund_id', e.target.value)}>
              <option value="">اختار…</option>
              {data?.funds.map((f) => <option key={f.id} value={f.id}>{f.name} — {money(f.balance)}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="الوصف" required error={errs.description}><input className="input" value={v.description} onChange={(e) => up('description', e.target.value)} placeholder="مثلاً: شراء 50 كيس طحين للسلات" /></Field></div>
          <Field label="المورّد / الجهة"><input className="input" value={v.vendor} onChange={(e) => up('vendor', e.target.value)} /></Field>
          <Field label="ينحسب على">
            <select className="input" value={v.purpose} onChange={(e) => up('purpose', e.target.value)}>{Object.entries(PURPOSE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          {!!data?.camps.length && (
            <Field label="الحملة (اختياري)">
              <select className="input" value={v.campaign_id} onChange={(e) => up('campaign_id', e.target.value)}><option value="">بدون</option>{data.camps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
          )}
        </div>
        <div>
          <span className="field-label">صورة الفاتورة {v.kind !== 'cash_aid' && <span className="text-red-600">*</span>}</span>
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3">
              {file.type.startsWith('image/') && <img src={URL.createObjectURL(file)} alt="معاينة الفاتورة" className="size-16 rounded-lg object-cover" />}
              <span className="flex-1 text-sm truncate">{file.name}</span>
              <button type="button" className="size-10 grid place-items-center rounded-lg hover:bg-ink-100" onClick={() => setFile(null)} aria-label="حذف الصورة"><X className="size-5" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 py-6 cursor-pointer hover:bg-ink-50">
              <Camera className="size-8 text-ink-500" /><span className="font-semibold">صوّر الفاتورة أو اختار ملف</span>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" capture="environment" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f && !ALLOWED[f.type]) { setErrs((x) => ({ ...x, file: 'ارفع صورة (JPG أو PNG) أو ملف PDF فقط' })); return; } if (f && f.size > 8_000_000) { setErrs((x) => ({ ...x, file: 'الملف أكبر من 8 ميغا' })); return; } setFile(f ?? null); setErrs((x) => ({ ...x, file: '' })); }} />
            </label>
          )}
          {errs.file && <p className="text-sm text-red-600 mt-1">{errs.file}</p>}
        </div>
      </div>
      <button className="btn-gold w-full h-12 mt-4" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ المصروف'}</button>
    </form>
  );
}
