import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FilePlus2, ChevronRight, Send, MapPin, Crosshair, Tag, Users, Check, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase, errText, type Family } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { CATEGORIES, GOVERNORATES, BREADWINNER, HOUSING, TIER, num } from '../lib/format';
import { queueFamily, isNetworkError } from '../lib/offline';
import { Field, useToast, Modal, ListSkeleton } from '../components/ui';
import { PickerMap } from '../components/Maps';

const STEPS = ['الأفراد', 'الدخل', 'السكن والديون', 'الصحة والإعاقة', 'المرفقات والملاحظات'];
const DISTRICTS = ['الكرخ', 'الرصافة', 'الأعظمية', 'الكاظمية', 'المنصور', 'مدينة الصدر', 'أبو غريب', 'المحمودية', 'المدائن', 'الطارمية'];

type F = Omit<Family, 'id' | 'code' | 'score' | 'tier' | 'created_at' | 'assessed_at'>;
const blank: F = {
  head_name: '', phone: '', national_id: '', governorate: 'بغداد', district: '', neighborhood: '', landmark: '', lat: null, lng: null,
  categories: [], members: 1, children: 0, orphans: 0, elderly: 0, disabled: 0, chronic: 0, breadwinner: 'unknown', monthly_income: 0,
  income_source: '', housing: 'unknown', rent: 0, debts: 0, other_aid: false, researcher_bonus: 0, researcher_note: '', notes: '',
  status: 'pending_visit', reported_by_name: '', reported_by_phone: '',
};

/** Mirrors ch_family_score() in the database, for the preview only. */
export function scorePreview(f: F) {
  const per = f.monthly_income / Math.max(f.members, 1);
  let s = f.monthly_income <= 0 ? 30 : per < 50000 ? 20 : per < 100000 ? 10 : 0;
  s += ({ deceased: 15, prisoner: 15, unable: 10, unemployed: 5 } as Record<string, number>)[f.breadwinner] ?? 0;
  s += Math.min(15, 5 * (f.disabled + f.chronic));
  s += Math.min(10, f.children + f.elderly);
  s += ({ none: 10, encroach: 10, rent: 7 } as Record<string, number>)[f.housing] ?? 0;
  s += f.debts <= 0 ? 0 : f.monthly_income <= 0 || f.debts >= f.monthly_income * 6 ? 10 : f.debts >= f.monthly_income * 2 ? 6 : 3;
  s += f.other_aid ? 0 : 5;
  s += f.researcher_bonus;
  s = Math.min(100, s);
  return { score: s, tier: (s >= 70 ? 'A' : s >= 40 ? 'B' : 'C') as 'A' | 'B' | 'C' };
}

export default function FamilyForm() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const [f, setF] = useState<F>(blank);
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [gpsMsg, setGpsMsg] = useState('');
  const [dups, setDups] = useState<{ id: string; head_name: string; phone: string; neighborhood: string; why: string }[] | null>(null);
  const [pendingFull, setPendingFull] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('ch_families').select('*').eq('id', id).single().then(({ data }) => {
      if (data) { const { id: _i, code: _c, score: _s, tier: _t, created_at: _ca, assessed_at: _a, seq: _q, created_by: _cb, assessed_by: _ab, updated_at: _u, ...rest } = data; void _i; void _c; void _s; void _t; void _ca; void _a; void _q; void _cb; void _ab; void _u; setF({ ...blank, ...rest }); }
      setLoading(false);
    });
  }, [id]);

  const up = <K extends keyof F>(k: K, v: F[K]) => { setF((x) => ({ ...x, [k]: v })); setErrs((e) => { const n = { ...e }; delete n[k as string]; return n; }); };
  const numIn = (k: keyof F) => ({
    value: String(f[k] ?? 0), inputMode: 'numeric' as const, dir: 'ltr' as const, className: 'input text-left',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => up(k, Number(e.target.value.replace(/[^\d]/g, '')) as never),
  });

  const validateBasic = () => {
    const e: Record<string, string> = {};
    if (f.head_name.trim().split(/\s+/).length < 2) e.head_name = 'اكتب الاسم الثلاثي أو الرباعي';
    if (!/^07\d{9}$/.test(f.phone.replace(/\s/g, ''))) e.phone = 'رقم الهاتف لازم 11 رقم ويبدأ بـ 07';
    if (!f.district.trim()) e.district = 'اختار القضاء';
    if (!f.neighborhood.trim()) e.neighborhood = 'اكتب الحي أو المحلة';
    if (!f.landmark.trim()) e.landmark = 'اكتب أقرب نقطة دالة';
    if (!f.categories.length) e.categories = 'اختار فئة وحدة على الأقل';
    if (!f.lat) e.map = 'حدد موقع العائلة على الخريطة';
    setErrs(e);
    if (Object.keys(e).length) { document.querySelector(`[data-err="${Object.keys(e)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return !Object.keys(e).length;
  };
  const validateStep = (s: number) => {
    if (s === 0) return validateBasic();
    const e: Record<string, string> = {};
    if (s === 1 && f.breadwinner === 'unknown') e.breadwinner = 'اختار حالة المعيل';
    if (s === 2 && f.housing === 'unknown') e.housing = 'اختار نوع السكن';
    if (s === 0 && f.members < 1) e.members = 'عدد الأفراد واحد على الأقل';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const gps = () => {
    if (!navigator.geolocation) { setGpsMsg('جهازك ما يدعم تحديد الموقع'); return; }
    setGpsMsg('جاري تحديد موقعك…');
    navigator.geolocation.getCurrentPosition(
      (p) => { const v: [number, number] = [p.coords.latitude, p.coords.longitude]; up('lat', v[0]); up('lng', v[1]); setFocus(v); setErrs((e) => { const n = { ...e }; delete n.map; return n; });
        setGpsMsg(p.coords.accuracy > 60 ? `دقة الموقع ضعيفة (${Math.round(p.coords.accuracy)} م) — اسحب الدبوس لمكان البيت بالضبط` : ''); },
      () => setGpsMsg('ما كدرنا نحدد موقعك. اسمح للمتصفح بالموقع، أو اضغط على الخريطة بمكان البيت'),
      { enableHighAccuracy: true, timeout: 15000 });
  };

  const payload = (full: boolean) => {
    const row: Record<string, unknown> = { ...f, phone: f.phone.replace(/\s/g, ''), national_id: f.national_id || null };
    if (full) { row.status = 'active'; row.assessed_at = new Date().toISOString(); row.assessed_by = profile!.id; }
    else if (!editing) row.status = 'pending_visit';
    return row;
  };

  const checkDups = async () => {
    const phone = f.phone.replace(/\s/g, '');
    const found: { id: string; head_name: string; phone: string; neighborhood: string; why: string }[] = [];
    const { data: byPhone } = await supabase.from('ch_families').select('id,head_name,phone,neighborhood').eq('phone', phone);
    byPhone?.forEach((r) => r.id !== id && found.push({ ...r, why: 'نفس رقم الهاتف' }));
    if (f.national_id) {
      const { data: byNid } = await supabase.from('ch_families').select('id,head_name,phone,neighborhood').eq('national_id', f.national_id);
      byNid?.forEach((r) => r.id !== id && !found.some((x) => x.id === r.id) && found.push({ ...r, why: 'نفس رقم البطاقة الوطنية' }));
    }
    if (f.lat && f.lng) {
      const d = 0.0003; // ≈ 30 m
      const { data: near } = await supabase.from('ch_families').select('id,head_name,phone,neighborhood')
        .gte('lat', f.lat - d).lte('lat', f.lat + d).gte('lng', f.lng - d).lte('lng', f.lng + d);
      near?.forEach((r) => r.id !== id && !found.some((x) => x.id === r.id) && found.push({ ...r, why: 'مسجلة بنفس الموقع تقريباً (أقل من 30 م)' }));
    }
    return found;
  };

  const save = async (full: boolean, skipDup = false) => {
    if (!validateBasic()) { setStep(0); return; }
    setBusy(true);
    if (!navigator.onLine && !editing) {
      queueFamily(payload(full));
      setBusy(false);
      toast({ kind: 'ok', text: 'انحفظت بالجهاز — راح تنرفع أول ما يرجع الإنترنت' });
      nav('/families');
      return;
    }
    try {
      if (!skipDup) {
        const d = await checkDups();
        if (d.length) { setDups(d); setPendingFull(full); setBusy(false); return; }
      }
      const row = payload(full);
      const res = editing
        ? await supabase.from('ch_families').update(row).eq('id', id!).select('id,score,tier').single()
        : await supabase.from('ch_families').insert(row).select('id,score,tier').single();
      if (res.error) throw res.error;
      toast({ kind: 'ok', text: full ? `انحفظ التقييم: ${res.data.score} من 100 — فئة ${TIER[res.data.tier].short}` : 'انحفظ البلاغ، والعائلة بانتظار الزيارة' });
      nav(`/families/${res.data.id}`, { replace: true });
    } catch (e) {
      if (isNetworkError(e) && !editing) { queueFamily(payload(full)); toast({ kind: 'ok', text: 'انقطع الإنترنت — انحفظت بالجهاز وراح تنرفع لوحدها' }); nav('/families'); }
      else toast({ kind: 'err', text: errText(e) });
    } finally { setBusy(false); }
  };

  const next = () => { if (validateStep(step)) { setStep((s) => Math.min(4, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  const prev = () => { setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const preview = scorePreview(f);

  if (loading) return <ListSkeleton rows={6} />;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><FilePlus2 className="size-6" /></span>
        <div>
          <h1 className="text-xl font-bold">{editing ? 'تعديل بيانات العائلة' : 'بلاغ عن عائلة مستفيدة'}</h1>
          <p className="text-sm text-ink-500">{editing ? f.head_name : 'تسجيل زيارة ميدانية لعائلة محتاجة'}</p>
        </div>
      </div>

      {/* Stepper */}
      <ol className="card px-3 py-4 mb-4 grid grid-cols-5" aria-label="خطوات الاستمارة">
        {STEPS.map((s, i) => (
          <li key={s} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className={`absolute top-5 start-[-50%] w-full h-0.5 ${i <= step ? 'bg-brand-600' : 'bg-ink-200'}`} style={{ insetInlineStart: '-50%' }} aria-hidden />}
            <button type="button" onClick={() => (i < step ? setStep(i) : i > step && i === step + 1 ? next() : undefined)}
              className={`relative z-10 size-10 rounded-full grid place-items-center font-bold text-[15px] ring-4 ring-white transition-colors ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-700 text-white' : 'bg-ink-200 text-ink-700'}`}
              aria-current={i === step ? 'step' : undefined} aria-label={`الخطوة ${i + 1}: ${s}`}>
              {i < step ? <Check className="size-5" /> : i + 1}
            </button>
            <span className={`mt-1.5 text-[12px] sm:text-sm leading-4 ${i === step ? 'font-bold text-brand-700' : 'text-ink-700'}`}>{s}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-4">
        {step === 0 && (<>
          <div className="card p-4 lg:p-5">
            <h2 className="flex items-center gap-2 font-bold text-[17px] mb-4"><Users className="size-5 text-brand-600" />بيانات العائلة الأساسية</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div data-err="head_name"><Field label="اسم ربّ الأسرة" required error={errs.head_name}><input className="input" value={f.head_name} onChange={(e) => up('head_name', e.target.value)} placeholder="الاسم الرباعي" /></Field></div>
              <div data-err="phone"><Field label="رقم الهاتف" required error={errs.phone}><input className="input text-left" dir="ltr" inputMode="tel" value={f.phone} onChange={(e) => up('phone', e.target.value)} placeholder="07XX XXX XXXX" /></Field></div>
              <Field label="المحافظة" required>
                <select className="input" value={f.governorate} onChange={(e) => up('governorate', e.target.value)}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select>
              </Field>
              <div data-err="district"><Field label="القضاء" required error={errs.district}>
                <input className="input" list="districts" value={f.district} onChange={(e) => up('district', e.target.value)} placeholder="مثلاً: الكرخ" />
                <datalist id="districts">{DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist>
              </Field></div>
              <div data-err="neighborhood"><Field label="الحي / المحلة" required error={errs.neighborhood}><input className="input" value={f.neighborhood} onChange={(e) => up('neighborhood', e.target.value)} placeholder="مثلاً: حي العامل" /></Field></div>
              <Field label="رقم البطاقة الوطنية" hint="اختياري — يساعد بمنع التكرار"><input className="input text-left" dir="ltr" inputMode="numeric" value={f.national_id ?? ''} onChange={(e) => up('national_id', e.target.value)} /></Field>
              <div className="sm:col-span-2" data-err="landmark"><Field label="أقرب نقطة دالة" required error={errs.landmark}><input className="input" value={f.landmark} onChange={(e) => up('landmark', e.target.value)} placeholder="مثلاً: قرب مدرسة العامل الابتدائية، مقابل جامع النور" /></Field></div>
              <Field label="عدد أفراد الأسرة" required><input {...numIn('members')} /></Field>
            </div>
          </div>

          <div className="card p-4 lg:p-5" data-err="categories">
            <h2 className="flex items-center gap-2 font-bold text-[17px] mb-1"><Tag className="size-5 text-brand-600" />فئات الحالة <span className="text-red-600">*</span></h2>
            <p className="text-sm text-ink-500 mb-3">ممكن تختار أكثر من فئة</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const on = f.categories.includes(c.key);
                return (
                  <label key={c.key} className={`flex items-center gap-2.5 rounded-xl border px-3 h-12 cursor-pointer select-none transition-colors ${on ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200 hover:bg-ink-50'}`}>
                    <input type="checkbox" className="size-5 accent-brand-700" checked={on} onChange={() => up('categories', on ? f.categories.filter((x) => x !== c.key) : [...f.categories, c.key])} />
                    {c.label}
                  </label>
                );
              })}
            </div>
            {errs.categories && <p className="text-sm text-red-600 mt-2">{errs.categories}</p>}
          </div>

          <div className="card p-4 lg:p-5" data-err="map">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="flex items-center gap-2 font-bold text-[17px]"><MapPin className="size-5 text-brand-600" />الموقع الجغرافي للعائلة <span className="text-red-600">*</span></h2>
              <button type="button" className="btn-ghost btn-sm" onClick={gps}><Crosshair className="size-4" />استخدم موقعي الحالي</button>
            </div>
            <PickerMap value={f.lat && f.lng ? [f.lat, f.lng] : null} focus={focus} onChange={(v) => { up('lat', v[0]); up('lng', v[1]); setErrs((e) => { const n = { ...e }; delete n.map; return n; }); }} />
            <p className="text-sm text-ink-500 mt-2">{gpsMsg || 'اضغط على الخريطة بمكان البيت، أو اسحب الدبوس الأحمر.'}</p>
            {f.lat && f.lng && <p className="text-sm mt-1">موقع العائلة: <span className="num">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</span></p>}
            {errs.map && <p className="text-sm text-red-600 mt-1">{errs.map}</p>}
          </div>

          {!editing && (
            <div className="card p-4 lg:p-5">
              <h2 className="font-bold text-[17px] mb-3">منو بلّغ عن العائلة؟ <span className="text-sm font-normal text-ink-500">(اختياري)</span></h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="اسم المُبلّغ"><input className="input" value={f.reported_by_name ?? ''} onChange={(e) => up('reported_by_name', e.target.value)} /></Field>
                <Field label="هاتف المُبلّغ"><input className="input text-left" dir="ltr" inputMode="tel" value={f.reported_by_phone ?? ''} onChange={(e) => up('reported_by_phone', e.target.value)} /></Field>
              </div>
            </div>
          )}
        </>)}

        {step === 1 && (
          <div className="card p-4 lg:p-5 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2" data-err="breadwinner">
              <span className="field-label">حالة معيل الأسرة <span className="text-red-600">*</span></span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(BREADWINNER).filter(([k]) => k !== 'unknown').map(([k, v]) => (
                  <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 h-12 cursor-pointer ${f.breadwinner === k ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200 hover:bg-ink-50'}`}>
                    <input type="radio" name="bw" className="size-5 accent-brand-700" checked={f.breadwinner === k} onChange={() => up('breadwinner', k)} />{v}
                  </label>
                ))}
              </div>
              {errs.breadwinner && <p className="text-sm text-red-600 mt-1">{errs.breadwinner}</p>}
            </div>
            <Field label="الدخل الشهري للأسرة (د.ع)" hint="اكتب 0 إذا ماكو دخل"><input {...numIn('monthly_income')} /></Field>
            <Field label="مصدر الدخل"><input className="input" value={f.income_source ?? ''} onChange={(e) => up('income_source', e.target.value)} placeholder="راتب، رعاية اجتماعية، عمل يومي…" /></Field>
            <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-ink-200 px-4 h-14 cursor-pointer">
              <input type="checkbox" className="size-5 accent-brand-700" checked={f.other_aid} onChange={(e) => up('other_aid', e.target.checked)} />
              العائلة تاخذ مساعدة من جهة ثانية (رعاية اجتماعية أو منظمة)
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="card p-4 lg:p-5 grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2" data-err="housing">
              <span className="field-label">نوع السكن <span className="text-red-600">*</span></span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(HOUSING).filter(([k]) => k !== 'unknown').map(([k, v]) => (
                  <label key={k} className={`flex items-center gap-2 rounded-xl border px-3 h-12 cursor-pointer ${f.housing === k ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200 hover:bg-ink-50'}`}>
                    <input type="radio" name="housing" className="size-5 accent-brand-700" checked={f.housing === k} onChange={() => up('housing', k)} />{v}
                  </label>
                ))}
              </div>
              {errs.housing && <p className="text-sm text-red-600 mt-1">{errs.housing}</p>}
            </div>
            {f.housing === 'rent' && <Field label="الإيجار الشهري (د.ع)"><input {...numIn('rent')} /></Field>}
            <Field label="مجموع الديون (د.ع)" hint="اكتب 0 إذا ماكو ديون"><input {...numIn('debts')} /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="card p-4 lg:p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="عدد الأطفال"><input {...numIn('children')} /></Field>
            <Field label="عدد الأيتام"><input {...numIn('orphans')} /></Field>
            <Field label="كبار السن"><input {...numIn('elderly')} /></Field>
            <Field label="ذوو الإعاقة"><input {...numIn('disabled')} /></Field>
            <Field label="أمراض مزمنة"><input {...numIn('chronic')} /></Field>
          </div>
        )}

        {step === 4 && (<>
          <div className="card p-4 lg:p-5 space-y-4">
            <div>
              <span className="field-label">تقدير الباحث (0 إلى 5 درجات)</span>
              <p className="text-sm text-ink-500 mb-2">لشي ما تلقاه الأرقام، مثل وضع البيت أو حالة نفسية صعبة. اكتب السبب تحت.</p>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => up('researcher_bonus', n)} aria-pressed={f.researcher_bonus === n}
                    className={`btn flex-1 h-12 ${f.researcher_bonus === n ? 'bg-brand-700 text-white' : 'bg-white border border-ink-200'}`}>{n}</button>
                ))}
              </div>
            </div>
            <Field label="سبب التقدير وملاحظات الباحث"><textarea className="input" rows={3} value={f.researcher_note ?? ''} onChange={(e) => up('researcher_note', e.target.value)} /></Field>
            <Field label="ملاحظات عامة"><textarea className="input" rows={3} value={f.notes ?? ''} onChange={(e) => up('notes', e.target.value)} /></Field>
          </div>
          <div className="card p-5 flex items-center gap-4">
            <span className={`size-16 rounded-2xl grid place-items-center text-2xl font-bold ${TIER[preview.tier].cls}`}>{TIER[preview.tier].short}</span>
            <div>
              <div className="text-sm text-ink-500">الدرجة المتوقعة</div>
              <div className="text-2xl font-bold"><span className="num">{preview.score}</span> <span className="text-base font-medium text-ink-500">من 100 — {TIER[preview.tier].label}</span></div>
            </div>
          </div>
        </>)}
      </div>

      {/* Actions */}
      <div className="sticky bottom-[76px] lg:bottom-4 mt-5 z-10">
        <div className="card p-3 flex gap-2 shadow-lift">
          {step > 0 && <button className="btn-ghost" onClick={prev}><ArrowRight className="size-5" />السابق</button>}
          {step === 0 && !editing && (
            <button className="btn-ghost flex-1 sm:flex-none" disabled={busy} onClick={() => save(false)}><Send className="size-5" />إرسال كبلاغ</button>
          )}
          {step < 4 ? (
            <button className="btn-primary flex-1" onClick={next}>{step === 0 ? 'زيارة كاملة وتقييم' : 'التالي'}<ArrowLeft className="size-5" /></button>
          ) : (
            <button className="btn-primary flex-1 h-12" disabled={busy} onClick={() => save(true)}><Check className="size-5" />{busy ? 'جاري الحفظ…' : 'اعتماد التقييم وحفظ'}</button>
          )}
        </div>
      </div>

      <Modal open={!!dups} onClose={() => setDups(null)} title="يمكن العائلة مسجلة من قبل">
        <div className="flex gap-3 rounded-xl bg-amber-50 text-amber-900 p-3 mb-4"><AlertTriangle className="size-5 shrink-0 mt-0.5" /><p className="text-[15px] leading-7">لكينا {num(dups?.length ?? 0)} عائلة تشبهها. تأكد قبل الحفظ حتى ما تاخذ العائلة حصتين.</p></div>
        <ul className="space-y-2">
          {dups?.map((d) => (
            <li key={d.id} className="rounded-xl border border-ink-200 p-3">
              <a href={`/families/${d.id}`} target="_blank" rel="noreferrer" className="font-bold hover:text-brand-700">{d.head_name}</a>
              <div className="text-sm text-ink-500">{d.neighborhood} · <span className="num">{d.phone}</span></div>
              <div className="text-sm text-amber-800 font-semibold mt-1">{d.why}</div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 mt-5">
          <button className="btn-ghost flex-1" onClick={() => setDups(null)}>رجوع وتعديل</button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => { setDups(null); save(pendingFull, true); }}>متأكد، احفظ</button>
        </div>
      </Modal>
    </div>
  );
}
