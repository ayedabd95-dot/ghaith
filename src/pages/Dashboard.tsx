import { Link } from 'react-router-dom';
import {
  Wallet, HandHeart, ShoppingCart, Users, UsersRound, Baby, Accessibility, Landmark, HeartHandshake, Home,
  Activity as ActivityIcon, PieChart, LineChart as LineIcon, Map as MapIcon, Megaphone, Truck, Bell, Coins, BarChart3,
  Package, ClipboardCheck, UserPlus, MapPin, Gift, ChevronLeft, AlertCircle, Clock, ClipboardList, type LucideIcon,
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { supabase, type Campaign, type Family } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, num, pct, monthKey, monthName, shortMoney, TIER, timeAgo, EXPENSE_KIND } from '../lib/format';
import { useLoad, StatTile, Section, Progress, Ring, Skeleton, ErrorBox } from '../components/ui';
import { FamilyMap } from '../components/Maps';

type Fam = Pick<Family, 'id' | 'head_name' | 'tier' | 'status' | 'categories' | 'members' | 'orphans' | 'disabled' | 'lat' | 'lng' | 'neighborhood' | 'created_at' | 'assessed_at'>;

async function load(office: boolean) {
  const since = new Date(); since.setMonth(since.getMonth() - 5, 1); since.setHours(0, 0, 0, 0);
  const [fam, camps, dists, items] = await Promise.all([
    supabase.from('ch_families').select('id,head_name,tier,status,categories,members,orphans,disabled,lat,lng,neighborhood,created_at,assessed_at'),
    supabase.from('ch_campaigns').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('ch_distributions').select('campaign_id,family_id,status,delivered_at'),
    supabase.from('ch_items').select('name,qty,min_qty'),
  ]);
  if (fam.error) throw fam.error;
  let funds: { balance: number }[] = [], dons: { amount_iqd: number; created_at: string; donor_name: string; method: string; id: string }[] = [],
    exps: { amount_iqd: number; created_at: string; description: string; kind: string; status: string; id: string; invoice_path: string | null }[] = [];
  if (office) {
    const [f, d, e] = await Promise.all([
      supabase.from('ch_fund_balances').select('balance'),
      supabase.from('ch_donations').select('id,amount_iqd,created_at,donor_name,method').gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('ch_expenses').select('id,amount_iqd,created_at,description,kind,status,invoice_path').gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
    ]);
    funds = f.data ?? []; dons = d.data ?? []; exps = e.data ?? [];
  }
  return { families: (fam.data ?? []) as Fam[], campaigns: (camps.data ?? []) as Campaign[], dists: dists.data ?? [], items: items.data ?? [], funds, dons, exps };
}

export default function Dashboard() {
  const { profile, can } = useAuth();
  const office = can('admin', 'accountant', 'auditor');
  const { data, loading, error, reload } = useLoad(() => load(office), [office]);

  if (error) return <ErrorBox text="تعذر تحميل البيانات" retry={reload} />;
  if (loading || !data) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
    </div>
  );

  const { families, campaigns, dists, items, funds, dons, exps } = data;
  const active = families.filter((f) => f.status === 'active');
  const thisMonth = monthKey(new Date());
  const balance = funds.reduce((s, f) => s + Number(f.balance), 0);
  const inMonth = dons.filter((d) => monthKey(d.created_at) === thisMonth).reduce((s, d) => s + Number(d.amount_iqd), 0);
  const outMonth = exps.filter((e) => e.status === 'approved' && monthKey(e.created_at) === thisMonth).reduce((s, e) => s + Number(e.amount_iqd), 0);
  const beneficiaries = active.reduce((s, f) => s + f.members, 0);
  const tiers = { A: active.filter((f) => f.tier === 'A').length, B: active.filter((f) => f.tier === 'B').length, C: active.filter((f) => f.tier === 'C').length };
  const has = (k: string) => active.filter((f) => f.categories.includes(k)).length;
  const orphans = active.reduce((s, f) => s + f.orphans, 0);
  const disabled = active.reduce((s, f) => s + f.disabled, 0);
  const cats = [
    { label: 'العوائل المحتاجة', n: has('needy'), unit: 'عائلة', icon: Users },
    { label: 'الأيتام', n: orphans, unit: 'يتيماً', icon: Baby },
    { label: 'عوائل المعتقلين', n: has('prisoner'), unit: 'عائلة', icon: Landmark },
    { label: 'ذوو الاحتياجات الخاصة', n: disabled, unit: 'مستفيد', icon: Accessibility },
    { label: 'الأرامل', n: has('widow'), unit: 'عائلة', icon: HeartHandshake },
  ];

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i, 1); months.push(monthKey(d)); }
  let running = 0;
  const chart = months.map((m) => {
    const inc = dons.filter((d) => monthKey(d.created_at) === m).reduce((s, d) => s + Number(d.amount_iqd), 0);
    const out = exps.filter((e) => e.status === 'approved' && monthKey(e.created_at) === m).reduce((s, e) => s + Number(e.amount_iqd), 0);
    running += inc - out;
    return { m: monthName(m), الواردات: inc, المصروفات: out, 'صافي الشهر التراكمي': running };
  });

  const camp = campaigns[0];
  const campDists = camp ? dists.filter((d) => d.campaign_id === camp.id) : [];
  const delivered = campDists.filter((d) => d.status === 'delivered').length;
  const pending = campDists.filter((d) => d.status === 'scheduled').length;
  const failed = campDists.filter((d) => d.status === 'not_delivered').length;
  const reached = new Set(dists.filter((d) => d.status === 'delivered').map((d) => d.family_id));
  const coverage = pct(active.filter((f) => reached.has(f.id)).length, active.length);
  const assessed = pct(families.filter((f) => f.status !== 'pending_visit').length, families.length);
  const withInvoice = pct(exps.filter((e) => e.invoice_path).length, exps.length);
  const newThisMonth = families.filter((f) => monthKey(f.created_at) === thisMonth).length;
  const visitsThisMonth = families.filter((f) => f.assessed_at && monthKey(f.assessed_at) === thisMonth).length;
  const basketsThisMonth = dists.filter((d) => d.delivered_at && monthKey(d.delivered_at) === thisMonth).length;
  const pendingVisits = families.filter((f) => f.status === 'pending_visit').length;
  const pendingExp = exps.filter((e) => e.status === 'pending').length;
  const lowStock = items.filter((i) => Number(i.qty) < Number(i.min_qty));

  const quick: { to: string; label: string; icon: LucideIcon; show: boolean; badge?: number }[] = [
    { to: '/families', label: 'العوائل والمستفيدون', icon: Users, show: true },
    { to: '/finance', label: 'التبرعات والصناديق', icon: Coins, show: can('admin', 'accountant', 'auditor', 'warehouse') },
    { to: '/inventory', label: 'المصروفات والمخزون', icon: Package, show: can('admin', 'accountant', 'auditor', 'warehouse') },
    { to: '/campaigns', label: 'الحملات والتوزيع', icon: Truck, show: !can('distributor') },
    { to: '/route', label: 'مساري اليوم', icon: Truck, show: can('distributor') },
    { to: '/team', label: 'الفريق والمتطوعون', icon: UsersRound, show: can('admin', 'auditor') },
    { to: '/reports', label: 'التقارير والإحصائيات', icon: BarChart3, show: office },
    { to: '/approvals', label: 'الموافقات', icon: ClipboardCheck, show: can('admin'), badge: pendingExp },
    { to: '/families/new', label: 'بلاغ عن عائلة', icon: UserPlus, show: can('admin', 'researcher') },
    { to: '/map', label: 'الخريطة', icon: MapIcon, show: true },
  ];

  return (
    <div className="space-y-4">
      {/* Mobile hero + quick grid */}
      <div className="lg:hidden rounded-2xl bg-gradient-to-l from-brand-700 to-brand-900 text-white p-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="text-sm text-white/80">أهلاً {profile!.full_name}</div>
          <h1 className="text-2xl font-bold mt-1 leading-10">معاً… لرعاية المحتاجين<br />وبناء مجتمع متكافل</h1>
        </div>
        <HandHeart aria-hidden className="absolute -bottom-4 -start-2 size-32 text-gold-500/30" />
      </div>
      <div className="lg:hidden grid grid-cols-4 gap-2">
        {quick.filter((q) => q.show).slice(0, 8).map((q) => (
          <Link key={q.to} to={q.to} className="lift card relative flex flex-col items-center justify-center gap-1.5 px-1 py-3 text-center min-h-[96px]">
            <q.icon className="size-7 text-brand-700" />
            <span className="text-[12px] font-semibold leading-4 text-ink-900">{q.label}</span>
            {!!q.badge && <span className="absolute top-1.5 end-1.5 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold grid place-items-center">{q.badge}</span>}
          </Link>
        ))}
      </div>

      {/* Stat tiles */}
      <div className={`grid grid-cols-2 gap-3 ${office ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {office && <StatTile tone="dark" label="الرصيد الحالي" value={money(balance)} icon={Wallet} />}
        {office && <StatTile tone="green" label="الواردات هذا الشهر" value={money(inMonth)} icon={HandHeart} />}
        {office && <StatTile tone="gold" label="المصروفات هذا الشهر" value={money(outMonth)} icon={ShoppingCart} />}
        <StatTile tone="green" label="إجمالي العوائل النشطة" value={num(active.length)} icon={Users} />
        <StatTile tone="purple" label="إجمالي المستفيدين" value={num(beneficiaries)} icon={UsersRound} />
        {!office && <StatTile tone="navy" label="بانتظار الزيارة" value={num(pendingVisits)} icon={ClipboardList} />}
        {!office && <StatTile tone="gold" label="سلة وزعت هذا الشهر" value={num(basketsThisMonth)} icon={Gift} />}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cats.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-[15px]">{c.label}</div>
                <div className="mt-1 text-xl font-bold"><span className="num">{num(c.n)}</span> <span className="text-sm font-medium text-ink-500">{c.unit}</span></div>
              </div>
              <span className="size-12 rounded-full bg-ink-100 grid place-items-center shrink-0"><c.icon className="size-6 text-ink-700" /></span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-bold text-brand-700 num">{pct(c.n, c.unit === 'عائلة' ? active.length : beneficiaries)}%</span>
              <div className="flex-1"><Progress value={pct(c.n, c.unit === 'عائلة' ? active.length : beneficiaries)} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="حالة العوائل حسب التقييم" icon={PieChart}>
          <div className="flex items-center gap-5">
            <TierDonut a={tiers.A} b={tiers.B} c={tiers.C} />
            <ul className="flex-1 space-y-3">
              {(['A', 'B', 'C'] as const).map((t) => (
                <li key={t}>
                  <Link to={`/families?tier=${t}`} className="flex items-center justify-between gap-2 rounded-lg hover:bg-ink-50 px-1 py-1">
                    <span className="flex items-center gap-2 text-[15px]"><span className={`size-3 rounded ${TIER[t].dot}`} />{TIER[t].short} - {TIER[t].label}</span>
                    <span className="font-bold num">{num(tiers[t])}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {office ? (
          <Section title="الواردات والمصروفات (آخر 6 أشهر)" icon={LineIcon}>
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eef1ef" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#66736c' }} reversed />
                  <YAxis orientation="right" tickFormatter={(v) => shortMoney(v)} tick={{ fontSize: 11, fill: '#66736c' }} width={52} />
                  <Tooltip formatter={(v: number) => money(v)} contentStyle={{ direction: 'rtl', borderRadius: 12, fontFamily: 'inherit' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="الواردات" fill="#145f39" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#8fd1a6" radius={[4, 4, 0, 0]} />
                  <Line dataKey="صافي الشهر التراكمي" stroke="#e07a1f" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Section>
        ) : (
          <Section title="خريطة العوائل" icon={MapIcon} action={<Link to="/map" className="text-sm font-semibold text-brand-700">عرض الكاملة</Link>}>
            <FamilyMap families={active} height={224} interactive={false} />
          </Section>
        )}

        <Section title="مؤشرات الأداء" icon={ActivityIcon}>
          <ul className="space-y-4">
            {[
              { l: 'نسبة تنفيذ الحملة الحالية', v: pct(delivered, campDists.length) },
              { l: 'نسبة تغطية العوائل النشطة', v: coverage },
              { l: 'العوائل المقيّمة ميدانياً', v: assessed },
              ...(office ? [{ l: 'مصروفات بفاتورة مرفوعة', v: withInvoice }] : []),
            ].map((k) => (
              <li key={k.l}>
                <div className="flex justify-between text-[15px] mb-1.5"><span>{k.l}</span><span className="font-bold text-brand-700 num">{k.v}%</span></div>
                <Progress value={k.v} />
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {office && (
          <Section title="خريطة العوائل" icon={MapIcon} action={<Link to="/map" className="text-sm font-semibold text-brand-700">عرض الكاملة</Link>}>
            <FamilyMap families={active} height={240} interactive={false} />
          </Section>
        )}
        <Section title="الحملات الحالية" icon={Megaphone} action={<Link to="/campaigns" className="text-sm font-semibold text-brand-700">كل الحملات</Link>}>
          {camp ? (
            <Link to={`/campaigns/${camp.id}`} className="flex items-center gap-4 rounded-xl border border-ink-200 p-3 hover:bg-ink-50">
              <Ring value={pct(delivered, campDists.length)} size={96} stroke={10}>
                <div className="font-bold text-lg num">{pct(delivered, campDists.length)}%</div>
              </Ring>
              <div className="min-w-0">
                <div className="font-bold">{camp.name}</div>
                <div className="text-sm text-ink-500 mt-1"><span className="num">{num(delivered)}</span> سلة موزعة من <span className="num">{num(campDists.length)}</span></div>
                {campaigns.length > 1 && <div className="text-xs text-ink-500 mt-1">+ {campaigns.length - 1} حملة نشطة ثانية</div>}
              </div>
            </Link>
          ) : <p className="text-ink-500 text-sm py-6 text-center">ماكو حملة نشطة هسه.</p>}
        </Section>
        <Section title="حالة التوزيع بالحملة الحالية" icon={Truck}>
          <div className="flex items-center gap-5">
            <Ring value={pct(delivered, campDists.length)} size={128} stroke={14}>
              <div><div className="text-2xl font-bold num">{num(delivered)}</div><div className="text-xs text-ink-500">من <span className="num">{num(campDists.length)}</span></div></div>
            </Ring>
            <ul className="flex-1 space-y-3 text-[15px]">
              <li className="flex justify-between"><span className="flex items-center gap-2"><span className="size-3 rounded bg-brand-600" />استلمت</span><b className="num">{num(delivered)}</b></li>
              <li className="flex justify-between"><span className="flex items-center gap-2"><span className="size-3 rounded bg-amber-400" />باقية</span><b className="num">{num(pending)}</b></li>
              <li className="flex justify-between"><span className="flex items-center gap-2"><span className="size-3 rounded bg-red-500" />لم تستلم</span><b className="num">{num(failed)}</b></li>
            </ul>
          </div>
        </Section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="تنبيهات ومهام عاجلة" icon={Bell}>
          <ul className="divide-y divide-ink-100">
            <Alert to="/families?status=pending_visit" icon={AlertCircle} tone="text-red-600" n={pendingVisits} text="عائلة بانتظار الزيارة الميدانية" />
            {can('admin') && <Alert to="/approvals" icon={Clock} tone="text-amber-500" n={pendingExp} text="مصروف بانتظار الموافقة" />}
            {lowStock.map((i) => <Alert key={i.name} to="/inventory" icon={Package} tone="text-navy-600" text={`مخزون «${i.name}» منخفض (${num(i.qty)} متبقي)`} />)}
            {!pendingVisits && !pendingExp && !lowStock.length && <li className="py-6 text-center text-ink-500 text-sm">ماكو مهام عاجلة.</li>}
          </ul>
        </Section>

        {office && (
          <Section title="آخر العمليات المالية" icon={Coins} action={<Link to="/finance" className="text-sm font-semibold text-brand-700">الكل</Link>}>
            <ul className="divide-y divide-ink-100">
              {[...dons.slice(0, 4).map((d) => ({ id: d.id, t: d.created_at, text: `تبرع — ${d.donor_name}`, amt: Number(d.amount_iqd), inc: true })),
                ...exps.slice(0, 4).map((e) => ({ id: e.id, t: e.created_at, text: e.description || EXPENSE_KIND[e.kind], amt: Number(e.amount_iqd), inc: false }))]
                .sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className={`size-7 rounded-full grid place-items-center text-white text-lg leading-none shrink-0 ${r.inc ? 'bg-brand-600' : 'bg-red-500'}`} aria-hidden>{r.inc ? '+' : '−'}</span>
                    <span className="flex-1 text-[15px] truncate">{r.text}</span>
                    <span className="text-end"><span className="block font-bold text-sm num">{money(r.amt)}</span><span className="block text-xs text-ink-500">{timeAgo(r.t)}</span></span>
                  </li>
                ))}
            </ul>
          </Section>
        )}

        <Section title="إحصائيات سريعة" icon={BarChart3}>
          <div className="grid grid-cols-2 gap-3">
            <Mini icon={UserPlus} n={newThisMonth} label="عائلة جديدة هذا الشهر" />
            <Mini icon={MapPin} n={visitsThisMonth} label="زيارة ميدانية هذا الشهر" />
            <Mini icon={Gift} n={basketsThisMonth} label="سلة موزعة هذا الشهر" />
            <Mini icon={Home} n={active.filter((f) => f.orphans > 0).length} label="عائلة فيها أيتام" />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Alert({ to, icon: Icon, tone, n, text }: { to: string; icon: LucideIcon; tone: string; n?: number; text: string }) {
  if (n === 0) return null;
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 py-3 hover:bg-ink-50 rounded-lg px-1">
        <Icon className={`size-5 shrink-0 ${tone}`} />
        <span className="flex-1 text-[15px]">{n !== undefined && <><b className="num">{num(n)}</b>{' '}</>}{text}</span>
        <ChevronLeft className="size-4 text-ink-500" />
      </Link>
    </li>
  );
}

function Mini({ icon: Icon, n, label }: { icon: LucideIcon; n: number; label: string }) {
  return (
    <div className="rounded-xl border border-ink-200 p-3">
      <Icon className="size-5 text-brand-600" />
      <div className="text-2xl font-bold mt-1 num">{num(n)}</div>
      <div className="text-xs text-ink-500 leading-5">{label}</div>
    </div>
  );
}

function TierDonut({ a, b, c }: { a: number; b: number; c: number }) {
  const total = a + b + c || 1, size = 140, stroke = 18, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const segs = [{ v: a, col: TIER.A.color }, { v: b, col: TIER.B.color }, { v: c, col: TIER.C.color }];
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1ef" strokeWidth={stroke} />
        {segs.map((s, i) => {
          const len = (s.v / total) * C;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.col} strokeWidth={stroke} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />;
          off += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-2xl font-bold num">{num(a + b + c)}</div><div className="text-xs text-ink-500">عائلة</div></div></div>
    </div>
  );
}
