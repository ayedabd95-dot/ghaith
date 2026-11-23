import { useState } from 'react';
import { Settings, BadgeCheck, IdCard, PenLine, Stamp as StampIcon, Trash2, Palette, Check } from 'lucide-react';
import { supabase, errText, type Org } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PLAN, dateAr, money, GOVERNORATES } from '../lib/format';
import { assetUrl, uploadOrgImage } from '../lib/logo';
import { PageHeader, Field, useToast } from '../components/ui';
import LogoPicker from '../components/LogoPicker';
import { Stamp, CardFront, CardBack, TEMPLATES, PALETTES, CARD_W, CARD_H, type Template } from '../components/IdCard';
import type { Profile } from '../lib/supabase';

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

const SAMPLE: Profile = {
  id: 'sample', full_name: 'أحمد محمد العلي', full_name_en: 'Ahmed Mohammed Al-Ali', phone: '07700000000', role: 'researcher', active: true,
  org_id: null, created_at: '', position: 'منسق البرامج الميدانية', position_en: 'Field Programs Coordinator', birth_date: '1992-05-14',
  blood_type: 'O+', photo_path: null, perms: [], serial_no: 1, id_number: 'GH-2026-00001', card_issued: '2026-01-15', card_expires: '2028-01-15',
  card_token: '00000000-0000-4000-8000-000000000000',
};

export default function OrgSettings() {
  const { org, setOrg } = useAuth();
  const toast = useToast();
  const o = org!;
  const [v, setV] = useState({
    name: o.name, tagline: o.tagline ?? '', governorate: o.governorate ?? 'بغداد', contact_phone: o.contact_phone ?? '', approval_threshold: String(o.approval_threshold),
    name_en: o.name_en ?? '', tagline_en: o.tagline_en ?? '', director_name: o.director_name ?? '', director_name_en: o.director_name_en ?? '',
    director_title: o.director_title ?? 'مدير المؤسسة', director_title_en: o.director_title_en ?? 'Director',
    address: o.address ?? '', address_en: o.address_en ?? '', email: o.email ?? '', website: o.website ?? '', card_prefix: o.card_prefix, card_years: String(o.card_years),
    primary_color: o.primary_color ?? '#0b3a23', accent_color: o.accent_color ?? '#c99a1e', card_template: (o.card_template ?? 'classic') as Template,
  });
  const [face, setFace] = useState<'front' | 'back'>('front');
  const [busy, setBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [err, setErr] = useState('');
  const previewOrg = {
    ...o, name: v.name || o.name, name_en: v.name_en || null, director_name: v.director_name || null, director_name_en: v.director_name_en || null,
    director_title: v.director_title, director_title_en: v.director_title_en, address: v.address || null, address_en: v.address_en || null,
    email: v.email || null, website: v.website || null, card_prefix: v.card_prefix.toUpperCase() || 'GH',
    primary_color: /^#[0-9a-fA-F]{6}$/.test(v.primary_color) ? v.primary_color : o.primary_color,
    accent_color: /^#[0-9a-fA-F]{6}$/.test(v.accent_color) ? v.accent_color : o.accent_color, card_template: v.card_template,
  };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (v.name.trim().length < 3) return setErr('اكتب اسم المؤسسة');
    const prefix = v.card_prefix.trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(prefix)) return setErr('رمز البطاقات من 2 إلى 5 حروف إنكليزية، مثل GH');
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return setErr('البريد الإلكتروني مو صحيح');
    if (![v.primary_color, v.accent_color].every((c) => /^#[0-9a-fA-F]{6}$/.test(c))) return setErr('اللون لازم يكون رمز مثل #0b3a23');
    setBusy(true);
    const { data, error } = await supabase.from('ch_orgs').update({
      name: v.name.trim(), tagline: v.tagline.trim() || null, governorate: v.governorate, contact_phone: v.contact_phone.replace(/\s/g, '') || null,
      approval_threshold: Number(v.approval_threshold.replace(/[^\d]/g, '')),
      name_en: v.name_en.trim() || null, tagline_en: v.tagline_en.trim() || null, director_name: v.director_name.trim() || null, director_name_en: v.director_name_en.trim() || null,
      director_title: v.director_title.trim() || null, director_title_en: v.director_title_en.trim() || null, address: v.address.trim() || null, address_en: v.address_en.trim() || null,
      email: v.email.trim() || null, website: v.website.trim().replace(/^https?:\/\//, '') || null, card_prefix: prefix, card_years: Number(v.card_years),
      primary_color: v.primary_color, accent_color: v.accent_color, card_template: v.card_template,
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

        <div className="card p-5 space-y-5">
          <h2 className="flex items-center gap-2 font-bold text-[17px]"><Palette className="size-5 text-brand-600" />ألوان المؤسسة ونموذج الهوية</h2>
          <div>
            <span className="field-label">ألوان جاهزة</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PALETTES.map((c) => {
                const on = v.primary_color.toLowerCase() === c.primary && v.accent_color.toLowerCase() === c.accent;
                return (
                  <button type="button" key={c.name} onClick={() => setV({ ...v, primary_color: c.primary, accent_color: c.accent })}
                    className={`lift flex items-center gap-2 rounded-xl border p-2 text-sm text-start ${on ? 'border-brand-600 ring-2 ring-brand-100' : 'border-ink-200'}`}>
                    <span className="flex shrink-0"><span className="size-6 rounded-full ring-2 ring-white" style={{ background: c.primary }} /><span className="size-6 rounded-full -ms-2 ring-2 ring-white" style={{ background: c.accent }} /></span>
                    <span className="flex-1 leading-5">{c.name}</span>{on && <Check className="size-4 text-brand-700" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {([['primary_color', 'اللون الأساسي'], ['accent_color', 'لون التمييز']] as const).map(([k, l]) => (
              <label key={k} className="block">
                <span className="field-label">{l}</span>
                <span className="flex items-center gap-2 rounded-xl border border-ink-300 h-12 px-2">
                  <input type="color" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} className="size-9 rounded-lg cursor-pointer border-0 bg-transparent p-0" aria-label={l} />
                  <input className="flex-1 min-w-0 text-left outline-none font-mono text-sm" dir="ltr" value={v[k]} maxLength={7}
                    onChange={(e) => { const x = e.target.value.trim(); setV({ ...v, [k]: x.startsWith('#') ? x : '#' + x }); }} aria-label={`${l} بالرمز`} />
                </span>
              </label>
            ))}
          </div>
          <div>
            <span className="field-label">نموذج الهوية</span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TEMPLATES.map((tp) => {
                const on = v.card_template === tp.key;
                return (
                  <button type="button" key={tp.key} onClick={() => setV({ ...v, card_template: tp.key })}
                    className={`lift rounded-2xl border p-2 text-center ${on ? 'border-brand-600 ring-2 ring-brand-100 bg-brand-50' : 'border-ink-200 bg-white'}`}>
                    <div className="mx-auto overflow-hidden pointer-events-none" style={{ width: CARD_W * 0.36, height: CARD_H * 0.36 }}>
                      <div style={{ transform: 'scale(0.36)', transformOrigin: 'top right', width: CARD_W, height: CARD_H }}>
                        <CardFront p={SAMPLE} org={previewOrg} template={tp.key} />
                      </div>
                    </div>
                    <div className="font-bold mt-2 flex items-center justify-center gap-1">{on && <Check className="size-4 text-brand-700" />}{tp.label}</div>
                    <div className="text-xs text-ink-500">{tp.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="field-label mb-0">معاينة بالحجم الطبيعي</span>
              <div className="flex gap-1">
                <button type="button" className={`tab ${face === 'front' ? 'tab-active' : 'border border-ink-200'}`} onClick={() => setFace('front')}>الوجه</button>
                <button type="button" className={`tab ${face === 'back' ? 'tab-active' : 'border border-ink-200'}`} onClick={() => setFace('back')}>الظهر</button>
              </div>
            </div>
            <div className="flex justify-center rounded-2xl bg-ink-50 py-6 overflow-hidden">
              <div style={{ width: CARD_W * 0.8, height: CARD_H * 0.8 }}><div style={{ transform: 'scale(0.8)', transformOrigin: 'top right', width: CARD_W, height: CARD_H }}>
                {face === 'front' ? <CardFront p={SAMPLE} org={previewOrg} /> : <CardBack p={SAMPLE} org={previewOrg} />}
              </div></div>
            </div>
            <p className="text-xs text-ink-500 mt-2">المعاينة ببيانات تجريبية. اضغط «حفظ الإعدادات» حتى تنطبق على كل هويات المؤسسة.</p>
          </div>
        </div>

        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn-primary w-full h-12" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button>
      </form>
    </div>
  );
}
