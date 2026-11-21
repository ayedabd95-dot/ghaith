import { useState } from 'react';
import { Settings, BadgeCheck, IdCard, PenLine, Stamp as StampIcon, Trash2 } from 'lucide-react';
import { supabase, errText, type Org } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PLAN, dateAr, money, GOVERNORATES } from '../lib/format';
import { assetUrl, uploadOrgImage } from '../lib/logo';
import { PageHeader, Field, useToast } from '../components/ui';
import LogoPicker from '../components/LogoPicker';
import { Stamp } from '../components/IdCard';

function ImageSlot({ label, hint, icon: Icon, url, onPick, onClear, busy, preview }: {
  label: string; hint: string; icon: typeof PenLine; url: string | null; busy: boolean;
  onPick: (f: File) => void; onClear: () => void; preview?: React.ReactNode;
}) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-4">
        <div className="w-32 h-20 rounded-xl border border-ink-200 bg-[repeating-conic-gradient(#f1f3f2_0_25%,#fff_0_50%)] bg-[length:12px_12px] grid place-items-center overflow-hidden">
          {url ? <img src={url} alt={label} className="max-w-full max-h-full object-contain" /> : preview ?? <Icon className="size-7 text-ink-300" />}
        </div>
        <div className="flex flex-col gap-2">
          <label className={`btn-ghost btn-sm cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            {url ? 'تغيير' : 'رفع صورة'}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
          </label>
          {url && <button type="button" className="btn-ghost btn-sm text-red-700" disabled={busy} onClick={onClear}><Trash2 className="size-4" />حذف</button>}
        </div>
      </div>
      <p className="text-xs text-ink-500 mt-1.5">{hint}</p>
    </div>
  );
}

export default function OrgSettings() {
  const { org, setOrg } = useAuth();
  const toast = useToast();
  const o = org!;
  const [v, setV] = useState({
    name: o.name, tagline: o.tagline ?? '', governorate: o.governorate ?? 'بغداد', contact_phone: o.contact_phone ?? '', approval_threshold: String(o.approval_threshold),
    name_en: o.name_en ?? '', tagline_en: o.tagline_en ?? '', director_name: o.director_name ?? '', director_name_en: o.director_name_en ?? '',
    director_title: o.director_title ?? 'مدير المؤسسة', director_title_en: o.director_title_en ?? 'Director',
    address: o.address ?? '', address_en: o.address_en ?? '', email: o.email ?? '', website: o.website ?? '', card_prefix: o.card_prefix, card_years: String(o.card_years),
  });
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (v.name.trim().length < 3) return setErr('اكتب اسم المؤسسة');
    const prefix = v.card_prefix.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(prefix)) return setErr('رمز البطاقات من 2 إلى 5 حروف إنكليزية، مثل GH');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return setErr('البريد الإلكتروني مو صحيح');
    setBusy(true);
    const { data, error } = await supabase.from('ch_orgs').update({
      name: v.name.trim(), tagline: v.tagline.trim() || null, governorate: v.governorate, contact_phone: v.contact_phone.replace(/\s/g, '') || null,
      approval_threshold: Number(v.approval_threshold.replace(/[^\d]/g, '')),
      name_en: v.name_en.trim() || null, tagline_en: v.tagline_en.trim() || null, director_name: v.director_name.trim() || null, director_name_en: v.director_name_en.trim() || null,
      director_title: v.director_title.trim() || null, director_title_en: v.director_title_en.trim() || null, address: v.address.trim() || null, address_en: v.address_en.trim() || null,
      email: v.email.trim() || null, website: v.website.trim().replace(/^https?:\/\//, '') || null, card_prefix: prefix, card_years: Number(v.card_years),
    }).eq('id', o.id).select('*').single();
    setBusy(false);
    if (error) { setErr(errText(error)); return; }
    setOrg(data as Org);
    toast({ kind: 'ok', text: 'انحفظت إعدادات المؤسسة' });
  };
  const pickImg = async (kind: 'sign' | 'stamp', f: File) => {
    setImgBusy(true);
    try {
      const path = await uploadOrgImage(o.id, kind, f, kind === 'sign' ? o.signature_path : o.stamp_path);
      setOrg({ ...o, ...(kind === 'sign' ? { signature_path: path } : { stamp_path: path }) });
      toast({ kind: 'ok', text: kind === 'sign' ? 'انحفظ التوقيع' : 'انحفظ الختم' });
    } catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setImgBusy(false); }
  };
  const clearImg = async (kind: 'sign' | 'stamp') => {
    const col = kind === 'sign' ? 'signature_path' : 'stamp_path';
    const old = o[col];
    setImgBusy(true);
    const { error } = await supabase.from('ch_orgs').update({ [col]: null }).eq('id', o.id);
    if (!error && old) await supabase.storage.from('ch-logos').remove([old]);
    setImgBusy(false);
    if (error) toast({ kind: 'err', text: errText(error) }); else setOrg({ ...o, [col]: null });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="إعدادات المؤسسة" icon={Settings} />
      <div className="card p-5 mb-4 flex items-center gap-4 bg-brand-50 border-brand-100">
        <BadgeCheck className="size-10 text-brand-700 shrink-0" />
        <div>
          <div className="font-bold">اشتراك منصة غيث — باقة {PLAN[o.plan]}</div>
          <div className="text-sm text-ink-700">{o.subscription_ends ? <>فعّال لحد <b>{dateAr(o.subscription_ends)}</b>. للتجديد تواصل ويا إدارة المنصة.</> : 'اشتراك مفتوح.'}</div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4" noValidate>
        <div className="card p-5 space-y-4">
          <LogoPicker orgId={o.id} path={o.logo_path} onChange={(p) => { setOrg({ ...o, logo_path: p }); toast({ kind: 'ok', text: p ? 'انحفظ الشعار' : 'انحذف الشعار' }); }} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="اسم المؤسسة" required><input className="input" value={v.name} onChange={set('name')} /></Field>
            <Field label="الاسم بالإنكليزي" hint="يطلع على الوجه الخلفي للهويات"><input className="input text-left" dir="ltr" value={v.name_en} onChange={set('name_en')} placeholder="Ghaith Humanitarian Foundation" /></Field>
            <Field label="وصف قصير"><input className="input" value={v.tagline} onChange={set('tagline')} /></Field>
            <Field label="الوصف بالإنكليزي"><input className="input text-left" dir="ltr" value={v.tagline_en} onChange={set('tagline_en')} /></Field>
            <Field label="المحافظة"><select className="input" value={v.governorate} onChange={set('governorate')}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="هاتف المؤسسة"><input className="input text-left" dir="ltr" inputMode="tel" value={v.contact_phone} onChange={set('contact_phone')} /></Field>
            <Field label="العنوان"><input className="input" value={v.address} onChange={set('address')} placeholder="بغداد، الكرادة، شارع 62" /></Field>
            <Field label="العنوان بالإنكليزي"><input className="input text-left" dir="ltr" value={v.address_en} onChange={set('address_en')} placeholder="Baghdad, Al-Karrada, 62nd St." /></Field>
            <Field label="البريد الإلكتروني"><input className="input text-left" dir="ltr" type="email" value={v.email} onChange={set('email')} /></Field>
            <Field label="الموقع الإلكتروني"><input className="input text-left" dir="ltr" value={v.website} onChange={set('website')} placeholder="www.example.org" /></Field>
          </div>
          <Field label="حد الموافقة على المصروفات (د.ع)" hint={`أي مصروف أكثر من ${money(Number(v.approval_threshold.replace(/[^\d]/g, '')))} يحتاج موافقتك`}>
            <input className="input text-left" dir="ltr" inputMode="numeric" value={v.approval_threshold} onChange={set('approval_threshold')} />
          </Field>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="flex items-center gap-2 font-bold text-[17px]"><IdCard className="size-5 text-brand-600" />هويات الفريق</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="اسم مدير المؤسسة"><input className="input" value={v.director_name} onChange={set('director_name')} placeholder="د. سامر عبد الرحيم" /></Field>
            <Field label="اسم المدير بالإنكليزي"><input className="input text-left" dir="ltr" value={v.director_name_en} onChange={set('director_name_en')} placeholder="Dr. Samer Abdulrahim" /></Field>
            <Field label="صفة المدير"><input className="input" value={v.director_title} onChange={set('director_title')} /></Field>
            <Field label="الصفة بالإنكليزي"><input className="input text-left" dir="ltr" value={v.director_title_en} onChange={set('director_title_en')} /></Field>
            <Field label="رمز أرقام البطاقات" hint="2–5 حروف إنكليزية، مثل GH ← GH-2026-00001"><input className="input text-left uppercase" dir="ltr" maxLength={5} value={v.card_prefix} onChange={set('card_prefix')} /></Field>
            <Field label="مدة صلاحية الهوية"><select className="input" value={v.card_years} onChange={set('card_years')}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y === 1 ? 'سنة' : y === 2 ? 'سنتين' : `${y} سنوات`}</option>)}</select></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 pt-2">
            <ImageSlot label="توقيع المدير" icon={PenLine} busy={imgBusy} url={assetUrl('ch-logos', o.signature_path)} onPick={(f) => pickImg('sign', f)} onClear={() => clearImg('sign')}
              hint="وقّع بقلم أزرق أو أسود على ورقة بيضاء وصوّرها، والأفضل PNG بخلفية شفافة." />
            <ImageSlot label="ختم المؤسسة" icon={StampIcon} busy={imgBusy} url={assetUrl('ch-logos', o.stamp_path)} onPick={(f) => pickImg('stamp', f)} onClear={() => clearImg('stamp')}
              preview={<Stamp org={o} size={72} />} hint="إذا ما رفعت ختم، النظام يسوي ختم دائري باسم المؤسسة تلقائياً (المعروض هنا)." />
          </div>
        </div>

        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn-primary w-full h-12" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button>
      </form>
    </div>
  );
}
