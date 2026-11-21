import { useEffect, useState } from 'react';
import { KeyRound, Trash2, Copy, MessageCircle, AlertTriangle } from 'lucide-react';
import { supabase, errText } from '../lib/supabase';
import { PLAN, ROLE_LABEL, GOVERNORATES, dateAr } from '../lib/format';
import { Modal, Field, Tabs, useToast, ListSkeleton } from './ui';
import LogoPicker from './LogoPicker';

export interface OrgInfo {
  id: string; name: string; tagline: string | null; governorate: string | null; contact_phone: string | null;
  plan: string; subscription_ends: string | null; created_at: string; logo_path: string | null;
}
interface Member { id: string; full_name: string; phone: string; role: string; active: boolean; created_at: string }

const genPw = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; const b = new Uint32Array(10); crypto.getRandomValues(b); return Array.from(b, (x) => a[x % a.length]).join(''); };

export async function callAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ch-admin-users', { body });
  if (error) {
    let msg = 'صار خطأ، حاول مرة ثانية';
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export default function OrgDetails({ org, onClose, onChanged }: { org: OrgInfo | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'info' | 'team' | 'delete'>('info');
  const [v, setV] = useState({ name: '', tagline: '', governorate: 'بغداد', contact_phone: '', plan: 'basic' });
  const [logo, setLogo] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [cred, setCred] = useState<{ name: string; phone: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!org) return;
    setTab('info'); setErr(''); setConfirm(''); setCred(null); setMembers(null);
    setV({ name: org.name, tagline: org.tagline ?? '', governorate: org.governorate ?? 'بغداد', contact_phone: org.contact_phone ?? '', plan: org.plan });
    setLogo(org.logo_path);
    // Reset only when a different organization is opened, not on every list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);
  useEffect(() => {
    if (org && tab === 'team' && !members) callAdmin({ action: 'org_members', org_id: org.id }).then((d) => setMembers(d.members)).catch((e) => setErr(e.message));
  }, [org, tab, members]);

  if (!org) return null;

  const save = async () => {
    setErr('');
    if (v.name.trim().length < 3) return setErr('اكتب اسم المؤسسة');
    setBusy(true);
    try {
      const { error } = await supabase.from('ch_orgs').update({ name: v.name.trim(), tagline: v.tagline.trim() || null, governorate: v.governorate, contact_phone: v.contact_phone.replace(/\s/g, '') || null }).eq('id', org.id);
      if (error) throw new Error(errText(error));
      if (v.plan !== org.plan) await callAdmin({ action: 'set_org', org_id: org.id, plan: v.plan });
      toast({ kind: 'ok', text: 'انحفظت بيانات المؤسسة' }); onChanged();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const resetPw = async (m: Member) => {
    const password = genPw(); setBusy(true);
    try { await callAdmin({ action: 'set_password', user_id: m.id, password }); setCred({ name: m.full_name, phone: m.phone, password }); }
    catch (e) { toast({ kind: 'err', text: (e as Error).message }); } finally { setBusy(false); }
  };
  const del = async () => {
    setErr(''); setBusy(true);
    try { await callAdmin({ action: 'delete_org', org_id: org.id, confirm_name: confirm }); toast({ kind: 'ok', text: `انحذفت ${org.name} وكل بياناتها` }); onClose(); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const share = cred ? `أهلاً ${cred.name}،\nهذي بيانات دخولك الجديدة لمنصة غيث:\nالرابط: ${location.origin}${import.meta.env.BASE_URL}\nرقم الهاتف: ${cred.phone}\nكلمة السر: ${cred.password}` : '';

  return (
    <Modal open={!!org} onClose={onClose} title={org.name} wide>
      <div className="mb-4"><Tabs value={tab} onChange={(t) => { setTab(t); setErr(''); }} items={[{ key: 'info', label: 'البيانات والشعار' }, { key: 'team', label: 'الفريق' }, { key: 'delete', label: 'حذف' }]} /></div>

      {tab === 'info' && (
        <div className="space-y-4">
          <LogoPicker orgId={org.id} path={logo} onChange={(p) => { setLogo(p); onChanged(); toast({ kind: 'ok', text: p ? 'انحفظ الشعار' : 'انحذف الشعار' }); }} />
          <Field label="اسم المؤسسة" required><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="وصف قصير"><input className="input" value={v.tagline} onChange={(e) => setV({ ...v, tagline: e.target.value })} /></Field>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="المحافظة"><select className="input" value={v.governorate} onChange={(e) => setV({ ...v, governorate: e.target.value })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="هاتف المؤسسة"><input className="input text-left" dir="ltr" inputMode="tel" value={v.contact_phone} onChange={(e) => setV({ ...v, contact_phone: e.target.value })} /></Field>
            <Field label="الباقة"><select className="input" value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })}>{Object.entries(PLAN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          </div>
          <p className="text-sm text-ink-500">مشتركة من {dateAr(org.created_at)} · الاشتراك لحد {org.subscription_ends ? dateAr(org.subscription_ends) : 'مفتوح'}</p>
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ التعديلات'}</button>
        </div>
      )}

      {tab === 'team' && (
        cred ? (
          <div>
            <p className="text-ink-700 mb-3">كلمة السر الجديدة جاهزة. ابعثها هسه لأنها ما تطلع مرة ثانية.</p>
            <pre className="rounded-xl bg-ink-50 p-4 text-[15px] whitespace-pre-wrap font-sans leading-7">{share}</pre>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(share); toast({ kind: 'ok', text: 'انتسخت' }); }}><Copy className="size-5" />نسخ</button>
              <a className="btn-primary" target="_blank" rel="noreferrer" href={`https://wa.me/964${cred.phone.slice(1)}?text=${encodeURIComponent(share)}`}><MessageCircle className="size-5" />واتساب</a>
            </div>
            <button className="btn-ghost w-full mt-2" onClick={() => setCred(null)}>رجوع للفريق</button>
          </div>
        ) : !members ? (err ? <p className="text-red-600">{err}</p> : <ListSkeleton rows={3} />) : (
          <ul className="divide-y divide-ink-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className="size-10 rounded-full bg-brand-700 text-white grid place-items-center font-bold shrink-0">{m.full_name.charAt(0)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.full_name} {!m.active && <span className="chip bg-red-50 text-red-700">موقوف</span>}</div>
                  <div className="text-sm text-ink-500">{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]} · <span className="num">{m.phone}</span></div>
                </div>
                <button className="btn-ghost btn-sm shrink-0" disabled={busy} onClick={() => resetPw(m)}><KeyRound className="size-4" />كلمة سر جديدة</button>
              </li>
            ))}
            {!members.length && <li className="py-6 text-center text-ink-500">ماكو أعضاء.</li>}
          </ul>
        )
      )}

      {tab === 'delete' && (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl bg-red-50 text-red-800 p-4">
            <AlertTriangle className="size-6 shrink-0" />
            <p className="leading-7">الحذف <b>نهائي وما يرجع</b>: تنمسح كل العوائل والتبرعات والمصروفات والحملات والفواتير وحسابات فريق «{org.name}». إذا بس ما دفعوا، استخدم زر الإيقاف بدل الحذف.</p>
          </div>
          <Field label={`حتى تأكد، اكتب اسم المؤسسة: ${org.name}`}><input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button className="btn-danger w-full" disabled={busy || confirm.trim() !== org.name.trim()} onClick={del}><Trash2 className="size-5" />{busy ? 'جاري الحذف…' : 'احذف المؤسسة نهائياً'}</button>
        </div>
      )}
    </Modal>
  );
}
