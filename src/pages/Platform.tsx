import { useState } from 'react';
import { Building2, Plus, PauseCircle, PlayCircle, CalendarPlus, Users, Home, Wallet, Copy, MessageCircle, SlidersHorizontal } from 'lucide-react';
import OrgDetails, { callAdmin } from '../components/OrgDetails';
import { logoUrl } from '../lib/logo';
import { supabase } from '../lib/supabase';
import { money, num, PLAN, dateAr, timeAgo, GOVERNORATES } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Empty, Modal, Field, useToast, Confirm, StatTile } from '../components/ui';

interface OrgRow {
  id: string; name: string; tagline: string | null; governorate: string | null; contact_phone: string | null;
  status: 'active' | 'suspended'; plan: string; subscription_ends: string | null; created_at: string; logo_path: string | null;
  members: number; families: number; donations_iqd: number; last_activity: string | null;
}

const genPw = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; const b = new Uint32Array(10); crypto.getRandomValues(b); return Array.from(b, (x) => a[x % a.length]).join(''); };
const today = () => new Date().toISOString().slice(0, 10);
const daysLeft = (d: string | null) => (d ? Math.ceil((new Date(d).getTime() - new Date(today()).getTime()) / 86_400_000) : null);

const call = callAdmin;

export default function Platform() {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ name: '', tagline: '', governorate: 'بغداد', plan: 'trial', months: '1', admin_name: '', admin_phone: '', password: genPw() });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ org: string; name: string; phone: string; password: string } | null>(null);
  const [extend, setExtend] = useState<OrgRow | null>(null);
  const [toggle, setToggle] = useState<OrgRow | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const { data, error } = await supabase.rpc('ch_platform_overview');
    if (error) throw error;
    return (data ?? []) as OrgRow[];
  });

  const live = (o: OrgRow) => o.status === 'active' && (!o.subscription_ends || o.subscription_ends >= today());
  const create = async () => {
    setErr(''); setBusy(true);
    try {
      await call({ action: 'create_org', ...nv, months: Number(nv.months) });
      setCreated({ org: nv.name, name: nv.admin_name, phone: nv.admin_phone.replace(/\s/g, ''), password: nv.password });
      setAdding(false); setNv({ name: '', tagline: '', governorate: 'بغداد', plan: 'trial', months: '1', admin_name: '', admin_phone: '', password: genPw() }); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const extendBy = async (o: OrgRow, months: number) => {
    const base = o.subscription_ends && o.subscription_ends > today() ? new Date(o.subscription_ends) : new Date();
    base.setMonth(base.getMonth() + months);
    setBusy(true);
    try { await call({ action: 'set_org', org_id: o.id, subscription_ends: base.toISOString().slice(0, 10), status: 'active' }); toast({ kind: 'ok', text: `تجدد اشتراك ${o.name} لحد ${dateAr(base)}` }); setExtend(null); reload(); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const doToggle = async () => {
    if (!toggle) return; setBusy(true);
    try { await call({ action: 'set_org', org_id: toggle.id, status: toggle.status === 'active' ? 'suspended' : 'active' }); toast({ kind: 'ok', text: toggle.status === 'active' ? `انوقفت ${toggle.name}` : `رجعت ${toggle.name} فعّالة` }); setToggle(null); reload(); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };

  const share = created ? `أهلاً ${created.name}،\nتم تفعيل «${created.org}» على منصة غيث.\nالرابط: ${location.origin}${import.meta.env.BASE_URL}\nرقم الهاتف: ${created.phone}\nكلمة السر: ${created.password}\nغيّر كلمة السر من «حسابي» بعد أول دخول، وبعدها ضيف فريقك من صفحة «الفريق».` : '';
  const list = data ?? [];
  const expiring = list.filter((o) => { const d = daysLeft(o.subscription_ends); return live(o) && d !== null && d <= 14; }).length;

  return (
    <div>
      <PageHeader title="المؤسسات المشتركة" sub="إدارة منصة غيث: المؤسسات، الاشتراكات، والحسابات" icon={Building2}
        actions={<button className="btn-primary" onClick={() => { setErr(''); setAdding(true); }}><Plus className="size-5" />مؤسسة جديدة</button>} />
      {error ? <ErrorBox text="تعذر تحميل المؤسسات" retry={reload} /> : loading || !data ? <ListSkeleton /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatTile tone="dark" label="المؤسسات المشتركة" value={num(list.length)} icon={Building2} />
            <StatTile tone="green" label="اشتراك فعّال" value={num(list.filter(live).length)} icon={PlayCircle} />
            <StatTile tone="gold" label="ينتهي خلال 14 يوم" value={num(expiring)} icon={CalendarPlus} />
            <StatTile tone="purple" label="عوائل مخدومة بالمنصة" value={num(list.reduce((s, o) => s + Number(o.families), 0))} icon={Home} />
          </div>
          {!list.length ? <div className="card"><Empty icon={Building2} title="ماكو مؤسسات بعد" text="ضيف أول مؤسسة، وراح يطلع حساب مديرها جاهز تبعثه بالواتساب." /></div> : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.map((o) => {
                const d = daysLeft(o.subscription_ends);
                const ok = live(o);
                return (
                  <div key={o.id} className={`card p-4 ${ok ? '' : 'border-red-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <img src={logoUrl(o.logo_path)} alt="" className="size-12 rounded-xl object-contain bg-ink-50 border border-ink-200 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[17px] truncate">{o.name}</div>
                        <div className="text-sm text-ink-500 truncate">{[o.governorate, o.contact_phone].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                      <span className={`chip shrink-0 ${ok ? (d !== null && d <= 14 ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-700') : 'bg-red-50 text-red-700'}`}>
                        {o.status === 'suspended' ? 'موقوفة' : !ok ? 'منتهي' : d !== null && d <= 14 ? `باقي ${d} يوم` : 'فعّالة'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <div className="rounded-lg bg-ink-50 p-2"><Users className="size-4 mx-auto text-ink-500" /><div className="font-bold num">{num(o.members)}</div><div className="text-[11px] text-ink-500">عضو</div></div>
                      <div className="rounded-lg bg-ink-50 p-2"><Home className="size-4 mx-auto text-ink-500" /><div className="font-bold num">{num(o.families)}</div><div className="text-[11px] text-ink-500">عائلة</div></div>
                      <div className="rounded-lg bg-ink-50 p-2"><Wallet className="size-4 mx-auto text-ink-500" /><div className="font-bold text-sm num">{num(Math.round(Number(o.donations_iqd) / 1000))}</div><div className="text-[11px] text-ink-500">ألف د.ع</div></div>
                    </div>
                    <div className="text-sm text-ink-500 mt-3 leading-6">
                      الاشتراك لحد: <b className="text-ink-900">{o.subscription_ends ? dateAr(o.subscription_ends) : 'مفتوح'}</b><br />
                      باقة {PLAN[o.plan]} · آخر نشاط: {o.last_activity ? timeAgo(o.last_activity) : 'ما بدأوا بعد'}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button className="btn-ghost btn-sm flex-1" onClick={() => setDetailsId(o.id)}><SlidersHorizontal className="size-4" />تفاصيل وتعديل</button>
                      <button className="btn-ghost btn-sm" onClick={() => setExtend(o)}><CalendarPlus className="size-4" />تجديد</button>
                      <button className={`btn-ghost btn-sm ${o.status === 'active' ? 'text-red-700' : ''}`} onClick={() => setToggle(o)} aria-label={o.status === 'active' ? 'إيقاف' : 'تفعيل'}>
                        {o.status === 'active' ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-sm text-ink-500 mt-4">للخصوصية، مالك المنصة يشوف الأرقام بس، وما يشوف أسماء العوائل أو تفاصيل حسابات المؤسسات. مجموع التبرعات المسجلة بكل المؤسسات: <b className="num">{money(list.reduce((s, o) => s + Number(o.donations_iqd), 0))}</b>.</p>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="مؤسسة جديدة على منصة غيث" wide>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><Field label="اسم المؤسسة" required><input className="input" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} autoFocus /></Field></div>
          <Field label="وصف قصير"><input className="input" value={nv.tagline} onChange={(e) => setNv({ ...nv, tagline: e.target.value })} placeholder="مثلاً: لرعاية الأيتام" /></Field>
          <Field label="المحافظة"><select className="input" value={nv.governorate} onChange={(e) => setNv({ ...nv, governorate: e.target.value })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <Field label="الباقة"><select className="input" value={nv.plan} onChange={(e) => setNv({ ...nv, plan: e.target.value })}>{Object.entries(PLAN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="مدة الاشتراك"><select className="input" value={nv.months} onChange={(e) => setNv({ ...nv, months: e.target.value })}>
            {[['1', 'شهر'], ['3', '3 أشهر'], ['6', '6 أشهر'], ['12', 'سنة'], ['24', 'سنتين']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <div className="sm:col-span-2 border-t border-ink-200 pt-4 font-bold">مدير المؤسسة</div>
          <Field label="اسمه الكامل" required><input className="input" value={nv.admin_name} onChange={(e) => setNv({ ...nv, admin_name: e.target.value })} /></Field>
          <Field label="رقم هاتفه" required hint="يدخل بيه للمنصة"><input className="input text-left" dir="ltr" inputMode="tel" value={nv.admin_phone} onChange={(e) => setNv({ ...nv, admin_phone: e.target.value })} placeholder="07XX XXX XXXX" /></Field>
          <div className="sm:col-span-2"><Field label="كلمة السر الأولى" hint="انولدت تلقائياً — يغيرها بعد أول دخول"><input className="input text-left" dir="ltr" value={nv.password} onChange={(e) => setNv({ ...nv, password: e.target.value })} /></Field></div>
        </div>
        {err && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 font-medium mt-4" role="alert">{err}</div>}
        <button className="btn-primary w-full mt-5" disabled={busy} onClick={create}>{busy ? 'جاري التفعيل…' : 'تفعيل المؤسسة وإنشاء حساب المدير'}</button>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="المؤسسة جاهزة">
        <p className="text-ink-700 mb-3">ابعث هاي البيانات لمدير المؤسسة. كلمة السر ما تطلع مرة ثانية.</p>
        <pre className="rounded-xl bg-ink-50 p-4 text-[15px] whitespace-pre-wrap font-sans leading-7">{share}</pre>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(share); toast({ kind: 'ok', text: 'انتسخت' }); }}><Copy className="size-5" />نسخ</button>
          <a className="btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/964${created?.phone.slice(1)}?text=${encodeURIComponent(share)}`}><MessageCircle className="size-5" />واتساب</a>
        </div>
      </Modal>

      <Modal open={!!extend} onClose={() => setExtend(null)} title={`تجديد اشتراك ${extend?.name ?? ''}`}>
        <p className="text-ink-700 mb-4">ينتهي حالياً: <b>{extend?.subscription_ends ? dateAr(extend.subscription_ends) : 'مفتوح'}</b>. التجديد يضاف على المدة الباقية.</p>
        <div className="grid grid-cols-2 gap-2">
          {[[1, 'شهر'], [3, '3 أشهر'], [6, '6 أشهر'], [12, 'سنة']].map(([m, l]) => (
            <button key={m} className="btn-ghost h-14" disabled={busy} onClick={() => extend && extendBy(extend, m as number)}>+ {l}</button>
          ))}
        </div>
      </Modal>
      <OrgDetails org={list.find((o) => o.id === detailsId) ?? null} onClose={() => setDetailsId(null)} onChanged={reload} />
      <Confirm open={!!toggle} onClose={() => setToggle(null)} busy={busy} danger={toggle?.status === 'active'}
        title={toggle?.status === 'active' ? 'إيقاف المؤسسة' : 'تفعيل المؤسسة'} confirmLabel={toggle?.status === 'active' ? 'أوقف' : 'فعّل'} onConfirm={doToggle}
        text={toggle?.status === 'active' ? <>كل فريق <b>{toggle?.name}</b> راح يطلع وما يكدرون يدخلون لحد ما ترجعها. بياناتهم تبقى محفوظة.</> : <>راح يرجع فريق <b>{toggle?.name}</b> يكدرون يدخلون.</>} />
    </div>
  );
}
