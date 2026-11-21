import { useMemo, useState } from 'react';
import { BarChart3, Printer, Download } from 'lucide-react';
import { supabase, type Donation, type Expense, type Fund } from '../lib/supabase';
import { money, pct, num, METHOD, PURPOSE, EXPENSE_KIND, monthKey, TIER, CATEGORIES, toCSV, dateAr } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Section } from '../components/ui';

const MONTHS = Array.from({ length: 12 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i, 1); return monthKey(d); });
const label = (k: string) => new Date(k + '-01').toLocaleDateString('ar-IQ-u-nu-latn', { month: 'long', year: 'numeric' });

function Bars({ rows }: { rows: { l: string; v: number }[] }) {
  const total = rows.reduce((s, r) => s + r.v, 0);
  if (!total) return <p className="text-sm text-ink-500 py-4">ماكو بيانات بهذي الفترة.</p>;
  return (
    <ul className="space-y-3">{rows.filter((r) => r.v).sort((a, b) => b.v - a.v).map((r) => (
      <li key={r.l}>
        <div className="flex justify-between text-[15px] mb-1"><span>{r.l}</span><span><b className="num">{money(r.v)}</b> <span className="text-ink-500 text-sm num">({pct(r.v, total)}%)</span></span></div>
        <div className="h-2 rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(r.v, total)}%` }} /></div>
      </li>
    ))}</ul>
  );
}

export default function Reports() {
  const [month, setMonth] = useState(MONTHS[0]);
  const { data, loading, error, reload } = useLoad(async () => {
    const [d, e, f, fam, dist] = await Promise.all([
      supabase.from('ch_donations').select('*'), supabase.from('ch_expenses').select('*'), supabase.from('ch_fund_balances').select('*'),
      supabase.from('ch_families').select('tier,status,categories,members,orphans'), supabase.from('ch_distributions').select('status,delivered_at'),
    ]);
    if (d.error) throw d.error;
    return { dons: d.data as Donation[], exps: e.data as Expense[], funds: f.data as Fund[], fams: fam.data ?? [], dists: dist.data ?? [] };
  });

  const r = useMemo(() => {
    if (!data) return null;
    const dons = month === 'all' ? data.dons : data.dons.filter((d) => monthKey(d.created_at) === month);
    const exps = (month === 'all' ? data.exps : data.exps.filter((e) => monthKey(e.created_at) === month)).filter((e) => e.status === 'approved');
    const inc = dons.reduce((s, d) => s + Number(d.amount_iqd), 0);
    const out = exps.reduce((s, e) => s + Number(e.amount_iqd), 0);
    const adminOut = exps.filter((e) => e.kind === 'admin').reduce((s, e) => s + Number(e.amount_iqd), 0);
    const baskets = data.dists.filter((d) => d.delivered_at && (month === 'all' || monthKey(d.delivered_at) === month)).length;
    const sum = <T,>(list: T[], key: (x: T) => string, val: (x: T) => number, labels: Record<string, string>) =>
      Object.keys(labels).map((k) => ({ l: labels[k], v: list.filter((x) => key(x) === k).reduce((s, x) => s + val(x), 0) }));
    return {
      dons, exps, inc, out, adminOut, baskets,
      byMethod: sum(dons, (d) => d.method, (d) => Number(d.amount_iqd), METHOD),
      byPurpose: sum(dons, (d) => d.purpose, (d) => Number(d.amount_iqd), PURPOSE),
      byKind: sum(exps, (e) => e.kind, (e) => Number(e.amount_iqd), EXPENSE_KIND),
      invoiced: pct(exps.filter((e) => e.invoice_path).length, exps.length),
    };
  }, [data, month]);

  if (error) return <ErrorBox text="تعذر تحميل التقارير" retry={reload} />;
  if (loading || !data || !r) return <ListSkeleton rows={6} />;
  const active = data.fams.filter((f) => f.status === 'active');
  const fundName = (id: string) => data.funds.find((f) => f.id === id)?.name ?? '';

  return (
    <div className="space-y-4">
      <PageHeader title="التقارير والإحصائيات" sub={`كشف ${month === 'all' ? 'كل الفترات' : label(month)}`} icon={BarChart3}
        actions={<div className="flex flex-wrap gap-2 no-print">
          <select className="input h-11 w-full sm:w-48" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="الفترة">
            {MONTHS.map((m) => <option key={m} value={m}>{label(m)}</option>)}<option value="all">كل الفترات</option>
          </select>
          <button className="btn-ghost" onClick={() => toCSV([
            ...r.dons.map((d) => ({ النوع: 'وارد', التاريخ: dateAr(d.created_at), البيان: `تبرع — ${d.donor_name} (وصل ${d.receipt_no})`, الصندوق: fundName(d.fund_id), الغرض: PURPOSE[d.purpose], المبلغ: d.amount_iqd })),
            ...r.exps.map((e) => ({ النوع: 'صادر', التاريخ: dateAr(e.created_at), البيان: e.description, الصندوق: fundName(e.fund_id), الغرض: PURPOSE[e.purpose], المبلغ: -e.amount_iqd })),
          ], `كشف-حساب-${month}.csv`)}><Download className="size-5" />كشف Excel</button>
          <button className="btn-primary" onClick={() => window.print()}><Printer className="size-5" />طباعة</button>
        </div>} />

      <div className="hidden print:block text-center mb-4"><div className="text-xl font-bold">مؤسسة الرحمة الخيرية — التقرير المالي</div><div>{month === 'all' ? 'كل الفترات' : label(month)}</div></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ l: 'الواردات', v: money(r.inc) }, { l: 'المصروفات المعتمدة', v: money(r.out) }, { l: 'الصافي', v: money(r.inc - r.out) }, { l: 'سلات وزعت', v: num(r.baskets) }].map((x) => (
          <div key={x.l} className="card p-4"><div className="text-sm text-ink-500">{x.l}</div><div className="text-xl font-bold mt-1 num">{x.v}</div></div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="الشفافية">
          <ul className="space-y-3 text-[15px]">
            <li className="flex justify-between"><span>نسبة المصروف على المستفيدين</span><b className="num text-brand-700">{pct(r.out - r.adminOut, r.out)}%</b></li>
            <li className="flex justify-between"><span>نسبة المصاريف الإدارية</span><b className="num">{pct(r.adminOut, r.out)}%</b></li>
            <li className="flex justify-between"><span>مصروفات بفاتورة مرفوعة</span><b className="num">{r.invoiced}%</b></li>
            <li className="flex justify-between"><span>عدد التبرعات</span><b className="num">{num(r.dons.length)}</b></li>
          </ul>
          <p className="text-sm text-ink-500 mt-3">الهدف: 90% أو أكثر من المصروف يروح للمستفيدين مباشرة.</p>
        </Section>
        <Section title="أرصدة الصناديق الحالية">
          <ul className="space-y-3 text-[15px]">{data.funds.map((f) => <li key={f.id} className="flex justify-between"><span>{f.name}</span><b className="num">{money(f.balance)}</b></li>)}
            <li className="flex justify-between border-t border-ink-200 pt-3 font-bold"><span>المجموع</span><span className="num">{money(data.funds.reduce((s, f) => s + Number(f.balance), 0))}</span></li></ul>
        </Section>
        <Section title="الواردات حسب طريقة التبرع"><Bars rows={r.byMethod} /></Section>
        <Section title="الواردات حسب الغرض"><Bars rows={r.byPurpose} /></Section>
        <Section title="المصروفات حسب النوع"><Bars rows={r.byKind} /></Section>
        <Section title="العوائل (الوضع الحالي)">
          <ul className="space-y-2 text-[15px]">
            <li className="flex justify-between"><span>العوائل النشطة</span><b className="num">{num(active.length)}</b></li>
            <li className="flex justify-between"><span>عدد المستفيدين</span><b className="num">{num(active.reduce((s, f) => s + f.members, 0))}</b></li>
            <li className="flex justify-between"><span>الأيتام</span><b className="num">{num(active.reduce((s, f) => s + f.orphans, 0))}</b></li>
            {(['A', 'B', 'C'] as const).map((t) => <li key={t} className="flex justify-between"><span>فئة {TIER[t].short} — {TIER[t].label}</span><b className="num">{num(active.filter((f) => f.tier === t).length)}</b></li>)}
            {CATEGORIES.map((c) => { const n = active.filter((f) => f.categories.includes(c.key)).length; return n ? <li key={c.key} className="flex justify-between text-ink-700"><span>{c.label}</span><span className="num">{num(n)}</span></li> : null; })}
          </ul>
        </Section>
      </div>
    </div>
  );
}
