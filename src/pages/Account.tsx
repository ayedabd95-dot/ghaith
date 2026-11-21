import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, KeyRound, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';
import { useOfflineQueue } from '../lib/offline';
import { PageHeader, Field, useToast, Confirm } from '../components/ui';

export default function Account() {
  const { profile, signOut } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const queue = useOfflineQueue();
  const [pw, setPw] = useState({ a: '', b: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  const change = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (pw.a.length < 8) return setErr('كلمة السر 8 أحرف على الأقل');
    if (pw.a !== pw.b) return setErr('كلمتا السر مو متطابقتين');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setBusy(false);
    if (error) setErr(/same/i.test(error.message) ? 'هاي نفس كلمة السر القديمة' : 'تعذر تغيير كلمة السر');
    else { setPw({ a: '', b: '' }); toast({ kind: 'ok', text: 'تغيرت كلمة السر' }); }
  };
  const out = async () => { await signOut(); nav('/login', { replace: true }); };
  const outEverywhere = async () => { await supabase.auth.signOut({ scope: 'global' }); await signOut(); nav('/login', { replace: true }); };

  return (
    <div className="max-w-xl">
      <PageHeader title="حسابي" icon={UserCircle} />
      <div className="card p-5 flex items-center gap-4">
        <span className="size-16 rounded-full bg-gold-500 text-white grid place-items-center text-2xl font-bold">{profile!.full_name.charAt(0)}</span>
        <div><div className="text-lg font-bold">{profile!.full_name}</div><div className="text-ink-500">{ROLE_LABEL[profile!.role]} · <span className="num">{profile!.phone}</span></div></div>
      </div>
      <form onSubmit={change} className="card p-5 mt-4 space-y-4">
        <h2 className="flex items-center gap-2 font-bold text-[17px]"><KeyRound className="size-5 text-brand-600" />تغيير كلمة السر</h2>
        <Field label="كلمة السر الجديدة"><input className="input" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
        <Field label="أعد كتابتها"><input className="input" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>حفظ كلمة السر</button>
      </form>
      <div className="card p-5 mt-4 space-y-2">
        <button className="btn-ghost w-full" onClick={() => (queue.length ? setAsk(true) : out())}><LogOut className="size-5" />تسجيل الخروج</button>
        <button className="btn-ghost w-full text-red-700" onClick={outEverywhere}>اطلع من كل الأجهزة</button>
      </div>
      <Confirm open={ask} onClose={() => setAsk(false)} danger title="تسجيل الخروج" confirmLabel="اطلع بكل الأحوال" onConfirm={out}
        text={<>عندك <b>{queue.length}</b> استمارة ما انرفعت. إذا طلعت تضيع.</>} />
    </div>
  );
}
