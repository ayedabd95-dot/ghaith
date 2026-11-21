import { useState } from 'react';
import { UsersRound, UserPlus, KeyRound, Ban, CheckCircle2, Copy } from 'lucide-react';
import { supabase, type Profile, type Role } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, num, pct } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Modal, Field, useToast, Confirm } from '../components/ui';

const genPw = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; const b = new Uint32Array(10); crypto.getRandomValues(b); return Array.from(b, (x) => a[x % a.length]).join(''); };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ch-admin-users', { body });
  if (error) {
    let msg = 'صار خطأ، حاول مرة ثانية';
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export default function Team() {
  const { can, profile } = useAuth();
  const toast = useToast();
  const admin = can('admin');
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ full_name: '', phone: '', role: 'researcher' as Role, password: genPw() });
  const [created, setCreated] = useState<{ phone: string; password: string; name: string } | null>(null);
  const [pwFor, setPwFor] = useState<Profile | null>(null);
  const [toggle, setToggle] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data, loading, error, reload } = useLoad(async () => {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const [p, f, d] = await Promise.all([
      supabase.from('ch_profiles').select('*').order('created_at'),
      supabase.from('ch_families').select('created_by,assessed_by,assessed_at,created_at'),
      supabase.from('ch_distributions').select('distributor_id,status,delivered_at'),
    ]);
    if (p.error) throw p.error;
    return { people: p.data as Profile[], fams: f.data ?? [], dists: d.data ?? [], since };
  });

  const stats = (u: Profile) => {
    if (!data) return [];
    const m = (t: string | null) => !!t && new Date(t) >= data.since;
    if (u.role === 'researcher' || u.role === 'admin') {
      return [{ l: 'عوائل سجلها', v: data.fams.filter((f) => f.created_by === u.id).length }, { l: 'زيارات هذا الشهر', v: data.fams.filter((f) => f.assessed_by === u.id && m(f.assessed_at)).length }];
    }
    if (u.role === 'distributor') {
      const mine = data.dists.filter((d) => d.distributor_id === u.id);
      return [{ l: 'سلات هذا الشهر', v: mine.filter((d) => m(d.delivered_at)).length }, { l: 'نسبة الإنجاز', v: pct(mine.filter((d) => d.status === 'delivered').length, mine.length), suf: '%' }];
    }
    return [];
  };

  const create = async () => {
    setErr(''); setBusy(true);
    try {
      await call({ action: 'create', ...nv, phone: nv.phone.replace(/\s/g, '') });
      setCreated({ phone: nv.phone.replace(/\s/g, ''), password: nv.password, name: nv.full_name });
      setAdding(false); setNv({ full_name: '', phone: '', role: 'researcher', password: genPw() }); reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const resetPw = async () => {
    if (!pwFor) return;
    const password = genPw(); setBusy(true);
    try { await call({ action: 'set_password', user_id: pwFor.id, password }); setCreated({ phone: pwFor.phone, password, name: pwFor.full_name }); setPwFor(null); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const doToggle = async () => {
    if (!toggle) return; setBusy(true);
    try { await call({ action: 'set_active', user_id: toggle.id, active: !toggle.active }); toast({ kind: 'ok', text: toggle.active ? 'انوقف الحساب وطلع من كل الأجهزة' : 'رجع الحساب فعّال' }); setToggle(null); reload(); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const changeRole = async (u: Profile, role: Role) => {
    try { await call({ action: 'set_role', user_id: u.id, role }); toast({ kind: 'ok', text: `صار ${u.full_name}: ${ROLE_LABEL[role]}` }); reload(); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); }
  };
  const share = created ? `أهلاً ${created.name}، هذا حسابك بنظام مؤسسة الرحمة الخيرية:\nالرابط: ${location.origin}${import.meta.env.BASE_URL}\nرقم الهاتف: ${created.phone}\nكلمة السر: ${created.password}\nغيّر كلمة السر من «حسابي» بعد أول دخول.` : '';

  return (
    <div>
      <PageHeader title="الفريق والمتطوعون" sub="كل عضو يدخل بحسابه ويشوف بس اللي يخص دوره" icon={UsersRound}
        actions={admin && <button className="btn-primary" onClick={() => { setErr(''); setAdding(true); }}><UserPlus className="size-5" />عضو جديد</button>} />
      {error ? <ErrorBox text="تعذر تحميل الفريق" retry={reload} /> : loading || !data ? <ListSkeleton /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.people.map((u) => (
            <div key={u.id} className={`card p-4 ${u.active ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-3">
                <span className="size-12 rounded-full bg-brand-700 text-white grid place-items-center font-bold text-lg shrink-0">{u.full_name.charAt(0)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{u.full_name}{u.id === profile!.id && <span className="text-xs text-ink-500 font-normal"> (أنت)</span>}</div>
                  <div className="text-sm text-ink-500 num">{u.phone}</div>
                </div>
                {!u.active && <span className="chip bg-red-50 text-red-700">موقوف</span>}
              </div>
              {admin && u.id !== profile!.id ? (
                <select className="input h-10 mt-3 text-sm" value={u.role} onChange={(e) => changeRole(u, e.target.value as Role)} aria-label={`دور ${u.full_name}`}>
                  {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              ) : <div className="mt-3 chip bg-brand-50 text-brand-700">{ROLE_LABEL[u.role]}</div>}
              {stats(u).length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">{stats(u).map((s) => (
                  <div key={s.l} className="rounded-lg bg-ink-50 p-2"><div className="text-lg font-bold num">{num(s.v)}{'suf' in s ? s.suf : ''}</div><div className="text-xs text-ink-500">{s.l}</div></div>
                ))}</div>
              )}
              {admin && u.id !== profile!.id && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button className="btn-ghost btn-sm" onClick={() => setPwFor(u)}><KeyRound className="size-4" />كلمة سر جديدة</button>
                  <button className={`btn-ghost btn-sm ${u.active ? 'text-red-700' : ''}`} onClick={() => setToggle(u)}>{u.active ? <><Ban className="size-4" />إيقاف</> : <><CheckCircle2 className="size-4" />تفعيل</>}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="عضو جديد بالفريق">
        <div className="space-y-4">
          <Field label="الاسم الكامل" required><input className="input" value={nv.full_name} onChange={(e) => setNv({ ...nv, full_name: e.target.value })} autoFocus /></Field>
          <Field label="رقم الهاتف" required hint="يدخل بيه للنظام"><input className="input text-left" dir="ltr" inputMode="tel" value={nv.phone} onChange={(e) => setNv({ ...nv, phone: e.target.value })} placeholder="07XX XXX XXXX" /></Field>
          <Field label="الدور"><select className="input" value={nv.role} onChange={(e) => setNv({ ...nv, role: e.target.value as Role })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="كلمة السر الأولى" hint="انولدت تلقائياً — العضو يغيرها بعد أول دخول"><input className="input text-left" dir="ltr" value={nv.password} onChange={(e) => setNv({ ...nv, password: e.target.value })} /></Field>
          {err && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 font-medium" role="alert">{err}</div>}
          <button className="btn-primary w-full" disabled={busy} onClick={create}>{busy ? 'جاري الإنشاء…' : 'إنشاء الحساب'}</button>
        </div>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title="بيانات الدخول جاهزة">
        <p className="text-ink-700 mb-3">ابعث هاي البيانات للعضو. كلمة السر ما تطلع مرة ثانية.</p>
        <pre className="rounded-xl bg-ink-50 p-4 text-[15px] whitespace-pre-wrap font-sans leading-7">{share}</pre>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(share); toast({ kind: 'ok', text: 'انتسخت' }); }}><Copy className="size-5" />نسخ</button>
          <a className="btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/964${created?.phone.slice(1)}?text=${encodeURIComponent(share)}`}>إرسال بالواتساب</a>
        </div>
      </Modal>
      <Confirm open={!!pwFor} onClose={() => setPwFor(null)} busy={busy} title="كلمة سر جديدة" confirmLabel="ولّد كلمة سر" onConfirm={resetPw}
        text={<>راح تنولد كلمة سر جديدة لـ <b>{pwFor?.full_name}</b> والقديمة تبطل.</>} />
      <Confirm open={!!toggle} onClose={() => setToggle(null)} busy={busy} danger={toggle?.active} title={toggle?.active ? 'إيقاف الحساب' : 'تفعيل الحساب'} confirmLabel={toggle?.active ? 'أوقف' : 'فعّل'} onConfirm={doToggle}
        text={toggle?.active ? <>راح يطلع <b>{toggle?.full_name}</b> من النظام وما يكدر يدخل. بياناته وشغله يبقون محفوظين.</> : <>راح يرجع <b>{toggle?.full_name}</b> يكدر يدخل.</>} />
    </div>
  );
}
