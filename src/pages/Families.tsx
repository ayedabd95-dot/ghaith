import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, UserPlus, Search, Download, Phone, MapPin, ChevronLeft } from 'lucide-react';
import { supabase, type Family } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { TIER, FAMILY_STATUS, catLabel, CATEGORIES, num, toCSV, BREADWINNER, HOUSING, dateShort } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, Empty, ErrorBox } from '../components/ui';

export default function Families() {
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const tier = sp.get('tier') ?? '';
  const status = sp.get('status') ?? '';
  const cat = sp.get('cat') ?? '';
  const { data, loading, error, reload } = useLoad(async () => {
    const { data, error } = await supabase.from('ch_families').select('*').order('score', { ascending: false });
    if (error) throw error;
    return data as Family[];
  });

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const list = useMemo(() => {
    const t = q.trim();
    return (data ?? []).filter((f) =>
      (!tier || f.tier === tier) && (!status || f.status === status) && (!cat || f.categories.includes(cat)) &&
      (!t || f.head_name.includes(t) || f.phone.includes(t) || f.code.toLowerCase().includes(t.toLowerCase()) || f.neighborhood.includes(t)));
  }, [data, q, tier, status, cat]);

  const exportCsv = () => toCSV(list.map((f) => ({
    الرمز: f.code, 'رب الأسرة': f.head_name, الهاتف: f.phone, المحافظة: f.governorate, القضاء: f.district, الحي: f.neighborhood,
    'نقطة دالة': f.landmark, 'عدد الأفراد': f.members, الأيتام: f.orphans, المعيل: BREADWINNER[f.breadwinner], السكن: HOUSING[f.housing],
    'الدخل الشهري': f.monthly_income, الدرجة: f.score, الفئة: TIER[f.tier].short, الحالة: FAMILY_STATUS[f.status], الفئات: f.categories.map(catLabel).join('، '),
  })), `العوائل-${new Date().toISOString().slice(0, 10)}.csv`);

  return (
    <div>
      <PageHeader title="العوائل والمستفيدون" sub={data ? `${num(list.length)} من ${num(data.length)} عائلة` : undefined} icon={Users}
        actions={<>
          {can('admin', 'auditor', 'accountant') && <button className="btn-ghost" onClick={exportCsv} disabled={!list.length}><Download className="size-5" />تصدير Excel</button>}
          {can('admin', 'researcher') && <Link to="/families/new" className="btn-primary"><UserPlus className="size-5" />بلاغ عن عائلة</Link>}
        </>} />

      <div className="card p-3 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="size-5 absolute start-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
          <input className="input ps-10" placeholder="ابحث بالاسم، الهاتف، الرمز أو الحي" value={q} onChange={(e) => { setQ(e.target.value); set('q', e.target.value); }} aria-label="بحث" />
        </div>
        <select className="input lg:w-44" value={tier} onChange={(e) => set('tier', e.target.value)} aria-label="الفئة">
          <option value="">كل الفئات</option>
          {(['A', 'B', 'C'] as const).map((t) => <option key={t} value={t}>فئة {TIER[t].short} — {TIER[t].label}</option>)}
        </select>
        <select className="input lg:w-44" value={status} onChange={(e) => set('status', e.target.value)} aria-label="الحالة">
          <option value="">كل الحالات</option>
          {Object.entries(FAMILY_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input lg:w-44" value={cat} onChange={(e) => set('cat', e.target.value)} aria-label="نوع الحالة">
          <option value="">كل أنواع الحالات</option>
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {error ? <ErrorBox text="تعذر تحميل العوائل" retry={reload} /> : loading ? <ListSkeleton rows={8} /> : !list.length ? (
        <div className="card"><Empty icon={Users} title={data?.length ? 'ماكو نتائج' : 'ماكو عوائل بعد'} text={data?.length ? 'غيّر البحث أو الفلاتر.' : 'ابدأ بتسجيل أول عائلة، وراح تطلع هنا مع تقييمها وموقعها.'}
          action={!data?.length && can('admin', 'researcher') ? <Link to="/families/new" className="btn-primary"><UserPlus className="size-5" />ضيف أول عائلة</Link> : undefined} /></div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden md:block overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="bg-ink-50 text-ink-700 text-sm">
                <tr>{['الرمز', 'رب الأسرة', 'الحي', 'الأفراد', 'الدرجة', 'الفئة', 'الحالة', 'التسجيل', ''].map((h) => <th key={h} className="text-start font-semibold px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {list.map((f) => (
                  <tr key={f.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 text-ink-500 num">{f.code}</td>
                    <td className="px-4 py-3"><Link to={`/families/${f.id}`} className="font-semibold hover:text-brand-700">{f.head_name}</Link>
                      <div className="text-xs text-ink-500">{f.categories.map(catLabel).join('، ')}</div></td>
                    <td className="px-4 py-3 whitespace-nowrap">{f.neighborhood}</td>
                    <td className="px-4 py-3 num">{f.members}</td>
                    <td className="px-4 py-3 font-bold num">{f.status === 'pending_visit' ? '—' : f.score}</td>
                    <td className="px-4 py-3">{f.status !== 'pending_visit' && <span className={`chip ${TIER[f.tier].cls}`}>{TIER[f.tier].short} · {TIER[f.tier].label}</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusChip s={f.status} /></td>
                    <td className="px-4 py-3 text-ink-500 whitespace-nowrap">{dateShort(f.created_at)}</td>
                    <td className="px-2"><Link to={`/families/${f.id}`} className="size-9 grid place-items-center rounded-lg hover:bg-ink-100" aria-label={`فتح ملف ${f.head_name}`}><ChevronLeft className="size-5" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="md:hidden space-y-2">
            {list.map((f) => (
              <li key={f.id}>
                <Link to={`/families/${f.id}`} className="lift card flex items-center gap-3 p-3">
                  <span className={`size-12 rounded-xl grid place-items-center font-bold text-lg shrink-0 ${f.status === 'pending_visit' ? 'bg-ink-100 text-ink-500' : TIER[f.tier].cls}`}>{f.status === 'pending_visit' ? '؟' : TIER[f.tier].short}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{f.head_name}</div>
                    <div className="text-sm text-ink-500 flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><MapPin className="size-3.5" />{f.neighborhood}</span>
                      <span className="flex items-center gap-1"><Phone className="size-3.5" /><span className="num">{f.phone}</span></span>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    {f.status === 'pending_visit' ? <StatusChip s={f.status} /> : <><div className="font-bold text-lg num">{f.score}</div><div className="text-[11px] text-ink-500">من 100</div></>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function StatusChip({ s }: { s: string }) {
  const cls = s === 'active' ? 'bg-brand-50 text-brand-700' : s === 'pending_visit' ? 'bg-amber-50 text-amber-800' : 'bg-ink-100 text-ink-700';
  return <span className={`chip ${cls}`}>{FAMILY_STATUS[s]}</span>;
}
