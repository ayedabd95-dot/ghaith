import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock, LogIn, ShieldCheck, HelpCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Modal } from '../components/ui';

export default function Login() {
  const { profile, signIn, loading, blockedReason } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ phone?: string; pw?: string; form?: string }>(() => (blockedReason ? { form: blockedReason } : {}));
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  if (!loading && profile) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = phone.replace(/\s|-/g, '');
    const next: typeof err = {};
    if (!/^07\d{9}$/.test(p)) next.phone = 'رقم الهاتف لازم 11 رقم ويبدأ بـ 07';
    if (pw.length < 6) next.pw = 'اكتب كلمة السر';
    setErr(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const msg = await signIn(p, pw);
    setBusy(false);
    if (msg) setErr({ form: msg });
    else nav('/', { replace: true });
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between bg-brand-900 text-white p-12 overflow-hidden">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} width={52} height={52} alt="" className="rounded-xl" />
          <div><div className="font-bold text-xl">منصة غيث</div><div className="text-white/70 text-sm">لإدارة العمل الخيري</div></div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-[1.4]">غيث… يوصل الخير<br />لمستحقه بالضبط</h1>
          <p className="mt-4 text-white/80 leading-8 text-lg">منصة تدير بيها مؤسستك الخيرية: كل عائلة مسجلة بموقعها وتقييمها، وكل دينار له وصل، وكل سلة توصل لصاحبها.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70"><ShieldCheck className="size-5 text-gold-500" />بيانات العوائل محمية ولا يشوفها إلا الفريق المخوّل.</div>
        <div aria-hidden className="absolute -bottom-32 -start-32 size-96 rounded-full border-[40px] border-gold-500/15" />
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} width={72} height={72} alt="" className="rounded-2xl" />
            <div className="font-bold text-xl mt-3">منصة غيث</div>
            <div className="text-ink-500 text-sm">لإدارة العمل الخيري</div>
          </div>
          <h2 className="text-2xl font-bold">تسجيل الدخول</h2>
          <p className="text-ink-500 mt-1">ادخل برقم هاتفك وكلمة السر اللي استلمتها من مدير مؤسستك.</p>

          <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
            <label className="block">
              <span className="field-label">رقم الهاتف</span>
              <div className="relative">
                <Phone className="size-5 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
                <input className="input ps-11 text-left" dir="ltr" inputMode="numeric" autoComplete="username" placeholder="07XX XXX XXXX"
                  value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!err.phone} />
              </div>
              {err.phone && <span className="block text-sm text-red-600 mt-1">{err.phone}</span>}
            </label>
            <label className="block">
              <span className="field-label">كلمة السر</span>
              <div className="relative">
                <Lock className="size-5 absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
                <input className="input ps-11 pe-12" type={show ? 'text' : 'password'} autoComplete="current-password"
                  value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err.pw} />
                <button type="button" className="absolute end-1 top-1/2 -translate-y-1/2 size-10 grid place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
                  onClick={() => setShow((v) => !v)} aria-label={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}>
                  {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
              {err.pw && <span className="block text-sm text-red-600 mt-1">{err.pw}</span>}
            </label>
            {err.form && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-[15px] font-medium" role="alert">{err.form}</div>}
            <button className="btn-primary w-full h-12 text-base" disabled={busy}>
              <LogIn className="size-5" />{busy ? 'جاري الدخول…' : 'دخول'}
            </button>
          </form>
          <button className="mt-5 inline-flex items-center gap-1.5 text-brand-700 font-semibold hover:underline underline-offset-4 h-11" onClick={() => setHelp(true)}>
            <HelpCircle className="size-4" />نسيت كلمة السر؟
          </button>
        </div>
      </div>

      <Modal open={help} onClose={() => setHelp(false)} title="نسيت كلمة السر">
        <p className="leading-8 text-ink-700">تواصل ويا <b>مدير مؤسستك</b>. يكدر يسويلك كلمة سر جديدة من صفحة «الفريق» خلال دقيقة، وبعدها تدخل وتغيّرها من «حسابي».</p>
        <button className="btn-primary w-full mt-6" onClick={() => setHelp(false)}>تمام</button>
      </Modal>
    </div>
  );
}
