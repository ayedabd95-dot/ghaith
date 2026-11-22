import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Users, Wallet, ClipboardCheck, Package, Truck, Map, UsersRound, BarChart3, History, UserCircle,
  Bell, Search, Plus, LogOut, Building2, Settings, IdCard, Clock3, WifiOff, CloudUpload, ScanLine, Receipt, ShoppingCart, UserPlus, X, Menu,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { logoUrl } from '../lib/logo';
import { supabase, type Role } from '../lib/supabase';
import { ROLE_LABEL } from '../lib/format';
import { syncQueue, useOfflineQueue, useOnline } from '../lib/offline';
import { Confirm, Modal, useToast } from './ui';

interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[] | 'org' | 'any' }
const NAV: NavItem[] = [
  { to: '/', label: 'الرئيسية', icon: Home, roles: 'org' },
  { to: '/platform', label: 'المؤسسات المشتركة', icon: Building2, roles: ['owner'] },
  { to: '/families', label: 'العوائل والمستفيدون', icon: Users, roles: 'org' },
  { to: '/route', label: 'مساري اليوم', icon: Truck, roles: ['distributor'] },
  { to: '/finance', label: 'التبرعات والصناديق', icon: Wallet, roles: ['admin', 'accountant', 'auditor', 'warehouse'] },
  { to: '/approvals', label: 'الموافقات', icon: ClipboardCheck, roles: ['admin'] },
  { to: '/inventory', label: 'المخزون والسلات', icon: Package, roles: ['admin', 'warehouse', 'accountant', 'auditor'] },
  { to: '/campaigns', label: 'الحملات والتوزيع', icon: Truck, roles: ['admin', 'accountant', 'auditor', 'warehouse', 'researcher'] },
  { to: '/map', label: 'خريطة العوائل', icon: Map, roles: 'org' },
  { to: '/team', label: 'الفريق والمتطوعون', icon: UsersRound, roles: ['admin', 'auditor'] },
  { to: '/reports', label: 'التقارير والإحصائيات', icon: BarChart3, roles: ['admin', 'accountant', 'auditor'] },
  { to: '/activity', label: 'سجل النشاطات', icon: History, roles: ['admin', 'auditor'] },
  { to: '/attendance', label: 'الحضور والانصراف', icon: Clock3, roles: 'org' },
  { to: '/my-card', label: 'هويتي', icon: IdCard, roles: 'org' },
  { to: '/settings', label: 'إعدادات المؤسسة', icon: Settings, roles: ['admin'] },
  { to: '/account', label: 'حسابي', icon: UserCircle, roles: 'any' },
];

const BOTTOM: Record<Role, string[]> = {
  owner: ['/platform', '/account'],
  volunteer: ['/attendance', '/my-card'],
  admin: ['/', '/families', '/campaigns', '/reports'],
  accountant: ['/', '/finance', '/campaigns', '/reports'],
  auditor: ['/', '/finance', '/reports', '/activity'],
  researcher: ['/', '/families', '/map', '/account'],
  distributor: ['/', '/route', '/map', '/account'],
  warehouse: ['/', '/inventory', '/finance', '/account'],
};
const SHORT: Record<string, string> = {
  '/platform': 'المؤسسات', '/settings': 'الإعدادات', '/my-card': 'هويتي', '/attendance': 'الحضور',
  '/': 'الرئيسية', '/families': 'العوائل', '/route': 'مساري', '/finance': 'المالية', '/inventory': 'المخزن',
  '/campaigns': 'الحملات', '/map': 'الخريطة', '/reports': 'التقارير', '/activity': 'السجل', '/account': 'حسابي',
};

function Logo({ size = 44 }: { size?: number }) {
  const { org } = useAuth();
  return <img src={logoUrl(org?.logo_path)} width={size} height={size} alt="" className="rounded-xl shrink-0 object-contain bg-white/95" />;
}

function useAlerts() {
  const { profile, can } = useAuth();
  const loc = useLocation();
  const [alerts, setAlerts] = useState<{ text: string; to: string; n: number; tone: string }[]>([]);
  useEffect(() => {
    if (!profile || profile.role === 'owner' || profile.role === 'volunteer') return;
    (async () => {
      const out: { text: string; to: string; n: number; tone: string }[] = [];
      const { count: visits } = await supabase.from('ch_families').select('id', { count: 'exact', head: true }).eq('status', 'pending_visit');
      if (visits) out.push({ text: 'عائلة بانتظار الزيارة الميدانية', to: '/families?status=pending_visit', n: visits, tone: 'bg-red-600' });
      if (can('admin')) {
        const { count } = await supabase.from('ch_expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending');
        if (count) out.push({ text: 'مصروف بانتظار الموافقة', to: '/approvals', n: count, tone: 'bg-amber-500' });
      }
      if (can('admin', 'warehouse')) {
        const { data } = await supabase.from('ch_items').select('qty,min_qty');
        const low = (data ?? []).filter((i) => Number(i.qty) < Number(i.min_qty)).length;
        if (low) out.push({ text: 'مادة بالمخزن تحت الحد الأدنى', to: '/inventory', n: low, tone: 'bg-navy-600' });
      }
      if (can('distributor')) {
        const { count } = await supabase.from('ch_distributions').select('id', { count: 'exact', head: true }).eq('distributor_id', profile.id).eq('status', 'scheduled');
        if (count) out.push({ text: 'عائلة باقية بمسارك', to: '/route', n: count, tone: 'bg-brand-600' });
      }
      setAlerts(out);
    })();
  }, [profile, can, loc.pathname]);
  return alerts;
}

const today = new Date();
const gDate = today.toLocaleDateString('ar-IQ-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hDate = (() => { try { return today.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } })();

export default function Layout() {
  const { profile, org, signOut, idleWarning, stayActive } = useAuth();
  const orgName = org?.name ?? 'منصة غيث';
  const orgSub = org ? 'على منصة غيث' : 'إدارة المنصة';
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const online = useOnline();
  const queue = useOfflineQueue();
  const alerts = useAlerts();
  const [bellOpen, setBellOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [logoutAsk, setLogoutAsk] = useState(false);
  const [q, setQ] = useState('');
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrawer(false); setBellOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const c = (e: MouseEvent) => { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false); };
    document.addEventListener('mousedown', c);
    return () => document.removeEventListener('mousedown', c);
  }, []);
  useEffect(() => { if (online && queue.length) syncQueue().then((n) => n && toast({ kind: 'ok', text: `انرفعت ${n} استمارة كانت محفوظة بالجهاز` })); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = profile!.role;
  const vp = profile!.perms ?? [];
  const volunteerSees = (to: string) => ['/attendance', '/my-card', '/account'].includes(to)
    || (to === '/families' && (vp.includes('families_view') || vp.includes('families_add')))
    || (to === '/map' && vp.includes('families_view')) || (to === '/route' && vp.includes('distribute'))
    || (to === '/campaigns' && vp.includes('campaigns_view')) || (to === '/inventory' && vp.includes('inventory_view'));
  const items = NAV.filter((n) => role === 'volunteer' ? volunteerSees(n.to)
    : n.roles === 'any' || (n.roles === 'org' ? role !== 'owner' : n.roles.includes(role)));
  const bottomPaths = role === 'volunteer'
    ? ['/attendance', ...(vp.includes('families_view') || vp.includes('families_add') ? ['/families'] : []), ...(vp.includes('distribute') ? ['/route'] : []), '/my-card'].slice(0, 4)
    : BOTTOM[role];
  const bottom = bottomPaths.map((to) => NAV.find((n) => n.to === to)!).filter(Boolean);
  const alertCount = alerts.reduce((s, a) => s + a.n, 0);

  const quick = [
    { to: '/families/new', label: 'بلاغ عن عائلة', icon: UserPlus, roles: ['admin', 'researcher', ...(vp.includes('families_add') ? ['volunteer'] : [])] as Role[] },
    { to: '/finance/donation', label: 'تسجيل تبرع', icon: Receipt, roles: ['admin', 'accountant'] as Role[] },
    { to: '/finance/expense', label: 'تسجيل مصروف', icon: ShoppingCart, roles: ['admin', 'accountant', 'warehouse'] as Role[] },
    { to: '/campaigns/new', label: 'حملة جديدة', icon: Truck, roles: ['admin'] as Role[] },
    { to: '/route?scan=1', label: 'امسح QR وأكّد استلام', icon: ScanLine, roles: ['distributor', 'admin', ...(vp.includes('distribute') ? ['volunteer'] : [])] as Role[] },
  ].filter((x) => x.roles.includes(role));

  const doSignOut = async () => { setLogoutAsk(false); await signOut(); nav('/login', { replace: true }); };
  const askSignOut = () => (queue.length ? setLogoutAsk(true) : doSignOut());
  const search = (e: React.FormEvent) => { e.preventDefault(); if (q.trim()) nav(`/families?q=${encodeURIComponent(q.trim())}`); };

  const Bell_ = (
    <div className="relative" ref={bellRef}>
      <button className="relative size-11 grid place-items-center rounded-xl hover:bg-white/10" aria-label={`التنبيهات (${alertCount})`} aria-expanded={bellOpen} onClick={() => setBellOpen((v) => !v)}>
        <Bell className="size-6" />
        {alertCount > 0 && <span className="absolute -top-0.5 -start-0.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold grid place-items-center ring-2 ring-brand-900">{alertCount > 99 ? '99+' : alertCount}</span>}
      </button>
      {bellOpen && (
        <div className="anim-pop absolute end-0 lg:end-auto lg:start-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white text-ink-900 rounded-2xl shadow-lift border border-ink-200 p-2 z-50 origin-top">
          <div className="px-3 py-2 font-bold">تنبيهات ومهام</div>
          {alerts.length === 0 && <p className="px-3 py-4 text-sm text-ink-500">ماكو شي يحتاج انتباهك هسه.</p>}
          {alerts.map((a) => (
            <NavLink key={a.to} to={a.to} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-ink-50">
              <span className={`min-w-8 h-8 px-2 rounded-lg text-white text-sm font-bold grid place-items-center ${a.tone}`}>{a.n}</span>
              <span className="text-[15px]">{a.text}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );

  const SideNav = ({ onPick }: { onPick?: () => void }) => (
    <nav className="flex flex-col gap-1 p-3" aria-label="القائمة الرئيسية">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={onPick}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 h-12 text-[15px] font-semibold transition-colors ${isActive ? 'bg-white/12 text-white ring-1 ring-white/25 shadow-inner' : 'text-white/80 hover:bg-white/8 hover:text-white'}`}>
          <n.icon className="size-5 shrink-0" />{n.label}
        </NavLink>
      ))}
      <button onClick={askSignOut} className="flex items-center gap-3 rounded-xl px-3 h-12 text-[15px] font-semibold text-white/70 hover:bg-white/8 hover:text-white mt-2">
        <LogOut className="size-5" />تسجيل الخروج
      </button>
    </nav>
  );

  return (
    <div className="min-h-full lg:ps-72">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[70] btn-gold">تخطَّ إلى المحتوى</a>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-72 bg-brand-900 text-white flex-col no-print z-30">
        <div className="flex items-center gap-3 px-5 h-20 border-b border-white/10">
          <Logo />
          <div className="min-w-0"><div className="font-bold text-[17px] truncate">{orgName}</div><div className="text-xs text-white/70 truncate">{orgSub}</div></div>
        </div>
        <div className="flex-1 overflow-y-auto"><SideNav /></div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-brand-900 text-white no-print">
        <div className="flex items-center gap-3 px-4 lg:px-6 h-16 lg:h-20">
          <button className="lg:hidden size-11 grid place-items-center rounded-xl hover:bg-white/10" aria-label="فتح القائمة" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu className="size-6" /></button>
          <div className="lg:hidden flex items-center gap-2 min-w-0 flex-1">
            <Logo size={36} />
            <div className="min-w-0"><div className="font-bold text-[15px] truncate">{orgName}</div><div className="text-[11px] text-white/70 truncate">أهلاً {profile!.full_name.split(' ')[0]} · {ROLE_LABEL[role]}</div></div>
          </div>
          <div className="hidden lg:block text-sm leading-6 shrink-0"><div className="font-semibold">{gDate}</div><div className="text-white/70">{hDate}</div></div>
          {role === 'owner' || role === 'volunteer' ? <div className="flex-1" /> : <form onSubmit={search} className="hidden lg:flex flex-1 max-w-md mx-auto relative" role="search">
            <Search className="size-5 absolute start-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full h-11 rounded-xl bg-white text-ink-900 ps-10 pe-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-gold-500" placeholder="بحث عن عائلة، رقم هاتف أو رمز…" aria-label="بحث" />
          </form>}
          {quick.length > 0 && (
            <button className="hidden lg:inline-flex btn h-11 border border-brand-500 text-white hover:bg-white/10" onClick={() => setAddOpen(true)}><Plus className="size-5" />إضافة جديدة</button>
          )}
          {role !== 'owner' && role !== 'volunteer' && Bell_}
          <NavLink to="/account" className="hidden lg:flex items-center gap-3 ps-3 border-s border-white/15">
            <div className="text-end"><div className="text-xs text-white/70">{ROLE_LABEL[role]}</div><div className="font-semibold">{profile!.full_name}</div></div>
            <span className="size-11 rounded-full bg-gold-500 grid place-items-center font-bold text-lg">{profile!.full_name.charAt(0)}</span>
          </NavLink>
        </div>
        {(!online || queue.length > 0) && (
          <div className={`flex items-center gap-2 px-4 lg:px-6 py-2 text-sm font-semibold ${online ? 'bg-gold-500 text-white' : 'bg-red-600 text-white'}`} role="status">
            {online ? <CloudUpload className="size-4" /> : <WifiOff className="size-4" />}
            {online ? `جاري رفع ${queue.length} استمارة محفوظة بالجهاز…` : `أنت بدون إنترنت — شغلك ينحفظ وينرفع لوحده${queue.length ? ` (${queue.length} بالانتظار)` : ''}`}
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="anim-fade absolute inset-0 bg-ink-900/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 start-0 w-[82%] max-w-xs bg-brand-900 text-white overflow-y-auto" style={{ animation: 'slide-in 220ms var(--ease-out) both' }}>
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10">
              <div className="flex items-center gap-2"><Logo size={36} /><span className="font-bold">القائمة</span></div>
              <button className="size-11 grid place-items-center rounded-xl hover:bg-white/10" aria-label="إغلاق القائمة" onClick={() => setDrawer(false)}><X className="size-6" /></button>
            </div>
            <SideNav onPick={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <main id="main" className="px-4 lg:px-6 py-5 pb-28 lg:pb-10 max-w-[1500px] mx-auto">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-ink-200 pb-safe no-print" aria-label="التنقل السريع">
        <div className="grid grid-cols-5 items-end h-[68px] px-1">
          {bottom.slice(0, 2).map((n) => <BottomLink key={n.to} item={n} />)}
          <div className="grid place-items-center">
            {quick.length > 0 ? (
              <button className="btn size-16 -mt-7 rounded-full bg-brand-700 text-white ring-4 ring-white shadow-lift hover:bg-brand-800 p-0" aria-label="إضافة جديدة" onClick={() => setAddOpen(true)}>
                {role === 'distributor' ? <ScanLine className="size-7" /> : <Plus className="size-8" />}
              </button>
            ) : <span />}
          </div>
          {bottom.slice(2, 4).map((n) => <BottomLink key={n.to} item={n} />)}
        </div>
      </nav>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="إضافة جديدة">
        <div className="grid gap-2">
          {quick.map((x) => (
            <button key={x.to} className="lift flex items-center gap-3 rounded-xl border border-ink-200 px-4 h-16 text-start hover:bg-ink-50" onClick={() => { setAddOpen(false); nav(x.to); }}>
              <span className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><x.icon className="size-5" /></span>
              <span className="font-semibold text-[16px]">{x.label}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Confirm open={logoutAsk} onClose={() => setLogoutAsk(false)} danger title="تسجيل الخروج"
        text={<>عندك <b>{queue.length}</b> استمارة ما انرفعت بعد. إذا طلعت هسه راح تضيع. وصّل الإنترنت وانتظر لحد ما تنرفع.</>}
        confirmLabel="اطلع بكل الأحوال" onConfirm={doSignOut} />

      <Modal open={idleWarning} onClose={stayActive} title="باقي ويانا؟">
        <p className="text-ink-700 leading-7">ماكو نشاط من فترة. راح يطلعك النظام تلقائياً خلال دقيقة حتى يحمي البيانات.</p>
        <div className="flex gap-2 mt-6">
          <button className="btn-primary flex-1" onClick={stayActive}>باقي، كمّل</button>
          <button className="btn-ghost" onClick={doSignOut}>اطلع</button>
        </div>
      </Modal>
    </div>
  );
}

function BottomLink({ item }: { item: NavItem }): ReactNode {
  return (
    <NavLink to={item.to} end={item.to === '/'} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 h-full text-[12px] font-semibold ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
      {({ isActive }) => (<>
        <span className={`h-8 w-14 rounded-full grid place-items-center transition-colors ${isActive ? 'bg-brand-50' : ''}`}><item.icon className="size-6" /></span>
        {SHORT[item.to]}
      </>)}
    </NavLink>
  );
}
