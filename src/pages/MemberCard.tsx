import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronRight, IdCard, Printer, Camera, BadgeCheck, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase, errText, type Profile } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, ROLE_LABEL_EN, dateAr } from '../lib/format';
import { uploadMemberPhoto } from '../lib/logo';
import { useLoad, ListSkeleton, ErrorBox, Field, useToast, Confirm } from '../components/ui';
import { CardFront, CardBack, CARD_W, CARD_H, verifyUrl } from '../components/IdCard';

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Scales a fixed-size card down to fit narrow screens. */
function Fit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setS(Math.min(1, el.clientWidth / CARD_W)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full flex justify-center" style={{ height: CARD_H * s }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: 'top center', width: CARD_W, height: CARD_H }}>{children}</div>
    </div>
  );
}

export default function MemberCard({ self }: { self?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { org, profile, can } = useAuth();
  const memberId = self ? profile!.id : id!;
  const editable = can('admin') && !self;
  const [v, setV] = useState({ full_name_en: '', position: '', position_en: '', birth_date: '', blood_type: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [reissue, setReissue] = useState(false);

  const { data: p, loading, error, reload, setData } = useLoad(async () => {
    const { data, error } = await supabase.from('ch_profiles').select('*').eq('id', memberId).single();
    if (error) throw error;
    return data as Profile;
  }, [memberId]);
  useEffect(() => {
    if (p) setV({ full_name_en: p.full_name_en ?? '', position: p.position ?? '', position_en: p.position_en ?? '', birth_date: p.birth_date ?? '', blood_type: p.blood_type ?? '' });
  }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox text="تعذر تحميل بيانات العضو" retry={reload} />;
  if (loading || !p || !org) return <ListSkeleton rows={6} />;

  const preview: Profile = { ...p, ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x || null])) } as Profile;
  const missing = [!p.photo_path && 'الصورة', !v.full_name_en && 'الاسم بالإنكليزي', !v.birth_date && 'المواليد', !org.director_name && 'اسم المدير (من إعدادات المؤسسة)', !org.signature_path && 'التوقيع (من إعدادات المؤسسة)'].filter(Boolean) as string[];

  const save = async (extra: Partial<Profile> = {}) => {
    setErr('');
    if (v.full_name_en && !/^[A-Za-z .'-]+$/.test(v.full_name_en.trim())) return setErr('الاسم بالإنكليزي لازم بالحروف الإنكليزية بس');
    setBusy(true);
    const { data, error } = await supabase.from('ch_profiles').update({
      full_name_en: v.full_name_en.trim() || null, position: v.position.trim() || null, position_en: v.position_en.trim() || null,
      birth_date: v.birth_date || null, blood_type: v.blood_type || null, ...extra,
    }).eq('id', p.id).select('*').single();
    setBusy(false);
    if (error) { setErr(errText(error)); return false; }
    setData(data as Profile);
    return true;
  };
  const issue = async () => {
    const now = new Date(), exp = new Date(); exp.setFullYear(exp.getFullYear() + (org.card_years || 2));
    if (await save({ card_issued: iso(now), card_expires: iso(exp) })) toast({ kind: 'ok', text: 'انصدرت البطاقة' });
  };
  const doReissue = async () => {
    setReissue(false);
    const now = new Date(), exp = new Date(); exp.setFullYear(exp.getFullYear() + (org.card_years || 2));
    if (await save({ card_issued: iso(now), card_expires: iso(exp), card_token: crypto.randomUUID() })) toast({ kind: 'ok', text: 'انصدرت بطاقة جديدة، والقديمة بطّلت' });
  };
  const photo = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr('');
    try { const path = await uploadMemberPhoto(org.id, p.id, f, p.photo_path); setData({ ...p, photo_path: path }); toast({ kind: 'ok', text: 'انحفظت الصورة' }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const expired = p.card_expires && p.card_expires < iso(new Date());

  return (
    <div>
      <style>{`@media print {
        @page { size: 54mm 85.6mm; margin: 0; }
        html, body { background: #fff !important; }
        body * { visibility: hidden !important; }
        .print-area, .print-area * { visibility: visible !important; }
        .print-area { position: absolute; inset: 0; display: block !important; }
        .card-page { width: 54mm; height: 85.6mm; overflow: hidden; page-break-after: always; break-after: page; }
        .card-page > div { transform: scale(0.6) !important; transform-origin: top left !important; }
        .id-card { box-shadow: none !important; border-radius: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }`}</style>

      <div className="flex flex-wrap items-center gap-3 mb-5 no-print">
        {!self && <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>}
        <span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><IdCard className="size-6" /></span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold">{self ? 'هويتي' : `هوية ${p.full_name}`}</h1>
          <p className="text-sm text-ink-500">{p.card_issued ? <>صادرة {dateAr(p.card_issued)} · نافذة لحد {p.card_expires ? dateAr(p.card_expires) : '—'}{expired && <b className="text-red-700"> (منتهية)</b>}</> : 'ما انصدرت بعد'}</p>
        </div>
        {p.card_issued && <>
          <a className="btn-ghost" href={verifyUrl(p.card_token)} target="_blank" rel="noreferrer"><ExternalLink className="size-5" />صفحة التحقق</a>
          <button className="btn-primary" onClick={() => window.print()}><Printer className="size-5" />طباعة</button>
        </>}
      </div>

      <div className={`grid gap-6 ${editable ? 'xl:grid-cols-[1fr_auto]' : ''}`}>
        {editable && (
          <div className="space-y-4 no-print">
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-4">
                <label className={`relative size-24 rounded-2xl overflow-hidden bg-ink-100 grid place-items-center cursor-pointer border-2 border-dashed border-ink-300 hover:border-brand-600 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                  {p.photo_path ? <img src={supabase.storage.from('ch-ids').getPublicUrl(p.photo_path).data.publicUrl} alt="صورة العضو" className="w-full h-full object-cover" /> : <Camera className="size-8 text-ink-500" />}
                  <input type="file" accept="image/png,image/jpeg,image/webp" capture="user" className="sr-only" onChange={(e) => { photo(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <div className="text-sm text-ink-700 leading-6"><b>الصورة الشخصية</b><br />صورة واضحة للوجه بخلفية فاتحة. النظام يقصّها تلقائياً بمقاس الهوية.</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="الاسم بالإنكليزي" hint="يطلع على الوجه الخلفي"><input className="input text-left" dir="ltr" value={v.full_name_en} onChange={(e) => setV({ ...v, full_name_en: e.target.value })} placeholder="Ahmed Mohammed Ali" /></Field>
                <Field label="المواليد"><input className="input text-left" dir="ltr" type="date" value={v.birth_date} onChange={(e) => setV({ ...v, birth_date: e.target.value })} /></Field>
                <Field label="الصفة بالعربي" hint={`إذا فارغة تطلع: ${ROLE_LABEL[p.role]}`}><input className="input" value={v.position} onChange={(e) => setV({ ...v, position: e.target.value })} placeholder="منسق البرامج الإنسانية" /></Field>
                <Field label="الصفة بالإنكليزي" hint={`إذا فارغة تطلع: ${ROLE_LABEL_EN[p.role]}`}><input className="input text-left" dir="ltr" value={v.position_en} onChange={(e) => setV({ ...v, position_en: e.target.value })} /></Field>
                <Field label="فصيلة الدم (اختياري)"><select className="input" value={v.blood_type} onChange={(e) => setV({ ...v, blood_type: e.target.value })}><option value="">—</option>{BLOOD.map((b) => <option key={b}>{b}</option>)}</select></Field>
              </div>
              {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost flex-1" disabled={busy} onClick={async () => { if (await save()) toast({ kind: 'ok', text: 'انحفظت البيانات' }); }}>حفظ البيانات</button>
                {!p.card_issued
                  ? <button className="btn-primary flex-1" disabled={busy} onClick={issue}><BadgeCheck className="size-5" />إصدار البطاقة</button>
                  : <button className="btn-ghost flex-1" disabled={busy} onClick={() => setReissue(true)}><RefreshCw className="size-5" />إعادة إصدار / تجديد</button>}
              </div>
            </div>
            {missing.length > 0 && (
              <div className="card p-4 bg-amber-50 border-amber-200 flex gap-3 text-amber-900">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div className="text-sm leading-6">حتى تطلع الهوية كاملة ناقص: <b>{missing.join('، ')}</b>.{(!org.director_name || !org.signature_path) && <> <Link to="/settings" className="underline font-semibold">افتح إعدادات المؤسسة</Link></>}</div>
              </div>
            )}
          </div>
        )}

        <div className="print-area">
          <div className="grid sm:grid-cols-2 gap-6 justify-items-center">
            <div className="w-full max-w-[340px]">
              <div className="text-center text-sm font-semibold text-ink-500 mb-2 no-print">الوجه الأمامي</div>
              <div className="card-page"><Fit><CardFront p={preview} org={org} /></Fit></div>
            </div>
            <div className="w-full max-w-[340px]">
              <div className="text-center text-sm font-semibold text-ink-500 mb-2 no-print">الوجه الخلفي</div>
              <div className="card-page"><Fit><CardBack p={preview} org={org} /></Fit></div>
            </div>
          </div>
          {!p.card_issued && <p className="text-center text-sm text-ink-500 mt-4 no-print">هذي معاينة. الرقم والتواريخ تطلع بعد «إصدار البطاقة».</p>}
          {p.card_issued && <p className="text-center text-sm text-ink-500 mt-4 no-print">للطباعة: اختار ورق بحجم البطاقة (54×86 ملم) أو احفظها PDF وطبعها بمطبعة بطاقات PVC.</p>}
        </div>
      </div>

      <Confirm open={reissue} onClose={() => setReissue(false)} title="إعادة إصدار البطاقة" confirmLabel="أصدر بطاقة جديدة" onConfirm={doReissue}
        text={<>راح تنصدر بطاقة بتاريخ جديد، و<b>رمز التحقق بالبطاقة القديمة يبطل</b> (مفيد إذا ضاعت أو انسرقت). رقم البطاقة يبقى نفسه.</>} />
    </div>
  );
}
