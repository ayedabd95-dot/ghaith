import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Wallet, Receipt as ReceiptIcon, ShoppingCart, Plus, Banknote, Smartphone, Landmark, FileText, Download, Paperclip } from 'lucide-react';
import { supabase, type Donation, type Expense, type Fund } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { money, METHOD, PURPOSE, EXPENSE_KIND, EXPENSE_STATUS, dateShort, num, toCSV, dateAr } from '../lib/format';
import { useLoad, PageHeader, Tabs, ListSkeleton, Empty, ErrorBox, useToast } from '../components/ui';

const FUND_ICON = { cash: Banknote, zaincash: Smartphone, bank: Landmark } as const;

export default function Finance() {
  const { can } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const seesIncome = can('admin', 'accountant', 'auditor');
  const tab = (sp.get('tab') ?? (seesIncome ? 'funds' : 'expenses')) as 'funds' | 'donations' | 'expenses';
  const [q, setQ] = useState('');

  const { data, loading, error, reload } = useLoad(async () => {
    const [f, d, e] = await Promise.all([
      supabase.from('ch_fund_balances').select('*'),
      seesIncome ? supabase.from('ch_donations').select('*').order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
      supabase.from('ch_expenses').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    return { funds: (f.data ?? []) as Fund[], dons: (d.data ?? []) as Donation[], exps: (e.data ?? []) as Expense[] };
  }, [seesIncome]);

  const fundName = (id: string) => data?.funds.find((f) => f.id === id)?.name ?? '';
  const byPurpose = useMemo(() => {
    if (!data) return [];
    return Object.keys(PURPOSE).map((k) => {
      const inc = data.dons.filter((d) => d.purpose === k).reduce((s, d) => s + Number(d.amount_iqd), 0);
      const out = data.exps.filter((e) => e.purpose === k && e.status === 'approved').reduce((s, e) => s + Number(e.amount_iqd), 0);
      return { k, inc, out, bal: inc - out };
    }).filter((r) => r.inc || r.out);
  }, [data]);

  const openInvoice = async (path: string) => {
    const { data: s, error } = await supabase.storage.from('ch-invoices').createSignedUrl(path, 300);
    if (error || !s) toast({ kind: 'err', text: 'تعذر فتح الفاتورة' }); else window.open(s.signedUrl, '_blank', 'noopener');
  };

  const t = q.trim();
  const dons = (data?.dons ?? []).filter((d) => !t || d.donor_name.includes(t) || String(d.receipt_no) === t || (d.txn_ref ?? '').includes(t));
  const exps = (data?.exps ?? []).filter((e) => !t || e.description.includes(t) || (e.vendor ?? '').includes(t));

  return (
    <div>
      <PageHeader title="التبرعات والصناديق" sub="كل دينار داخل له وصل، وكل دينار طالع له فاتورة" icon={Wallet}
        actions={<>
          {can('admin', 'accountant') && <Link to="/finance/donation" className="btn-primary"><Plus className="size-5" />تسجيل تبرع</Link>}
          {can('admin', 'accountant', 'warehouse') && <Link to="/finance/expense" className="btn-gold"><ShoppingCart className="size-5" />تسجيل مصروف</Link>}
        </>} />
      <div className="mb-4">
        <Tabs value={tab} onChange={(v) => setSp({ tab: v }, { replace: true })} items={[
          ...(seesIncome ? [{ key: 'funds' as const, label: 'الصناديق والأرصدة' }, { key: 'donations' as const, label: 'التبرعات' }] : []),
          { key: 'expenses' as const, label: 'المصروفات' },
        ]} />
      </div>

      {error ? <ErrorBox text="تعذر تحميل البيانات المالية" retry={reload} /> : loading || !data ? <ListSkeleton rows={6} /> : tab === 'funds' ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {data.funds.map((f) => {
              const Icon = FUND_ICON[f.kind as keyof typeof FUND_ICON] ?? Wallet;
              return (
                <div key={f.id} className="card p-5">
                  <div className="flex items-center gap-3"><span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><Icon className="size-6" /></span><span className="font-bold">{f.name}</span></div>
                  <div className="text-2xl font-bold mt-4 num">{money(f.balance)}</div>
                  <div className="text-sm text-ink-500 mt-1">الرصيد الحالي</div>
                  <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                    <div className="rounded-lg bg-brand-50 p-2"><div className="text-ink-500">داخل</div><div className="font-bold text-brand-700 num">{money(f.income)}</div></div>
                    <div className="rounded-lg bg-red-50 p-2"><div className="text-ink-500">طالع</div><div className="font-bold text-red-700 num">{money(f.spent)}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card overflow-x-auto">
            <div className="px-4 pt-4 font-bold text-[17px]">الرصيد حسب الغرض</div>
            <p className="px-4 text-sm text-ink-500 mb-2">الزكاة لازم تنصرف على مستحقيها، فتابع رصيدها بشكل منفصل.</p>
            <table className="w-full text-[15px]">
              <thead className="bg-ink-50 text-sm text-ink-700"><tr>{['الغرض', 'داخل', 'مصروف', 'المتبقي'].map((h) => <th key={h} className="text-start px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink-100">
                {byPurpose.map((r) => (
                  <tr key={r.k}><td className="px-4 py-3 font-semibold">{PURPOSE[r.k]}</td><td className="px-4 py-3 num">{money(r.inc)}</td><td className="px-4 py-3 num">{money(r.out)}</td>
                    <td className={`px-4 py-3 font-bold num ${r.bal < 0 ? 'text-red-700' : ''}`}>{money(r.bal)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input className="input flex-1 min-w-[220px]" placeholder={tab === 'donations' ? 'ابحث بالمتبرع، رقم الوصل أو رقم العملية' : 'ابحث بالوصف أو المورّد'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" />
            <button className="btn-ghost" onClick={() => tab === 'donations'
              ? toCSV(dons.map((d) => ({ 'رقم الوصل': d.receipt_no, التاريخ: dateAr(d.created_at), المتبرع: d.donor_name, المبلغ: d.amount, العملة: d.currency, 'بالدينار': d.amount_iqd, الطريقة: METHOD[d.method], الصندوق: fundName(d.fund_id), الغرض: PURPOSE[d.purpose], 'رقم العملية': d.txn_ref ?? '' })), 'التبرعات.csv')
              : toCSV(exps.map((e) => ({ التاريخ: dateAr(e.created_at), الوصف: e.description, النوع: EXPENSE_KIND[e.kind], المبلغ: e.amount_iqd, الصندوق: fundName(e.fund_id), المورد: e.vendor ?? '', الحالة: EXPENSE_STATUS[e.status].label, فاتورة: e.invoice_path ? 'نعم' : 'لا' })), 'المصروفات.csv')}>
              <Download className="size-5" />تصدير Excel
            </button>
          </div>
          {tab === 'donations' ? (
            !dons.length ? <div className="card"><Empty icon={ReceiptIcon} title="ماكو تبرعات" text="سجّل أول تبرع وراح يطلعله وصل مرقّم تبعثه للمتبرع." /></div> : (
              <ul className="card divide-y divide-ink-100">
                {dons.map((d) => (
                  <li key={d.id}>
                    <Link to={`/finance/receipt/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
                      <span className="size-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0"><ReceiptIcon className="size-5" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{d.donor_name}</div>
                        <div className="text-sm text-ink-500">وصل <span className="num">#{d.receipt_no}</span> · {METHOD[d.method]} · {PURPOSE[d.purpose]} · {dateShort(d.created_at)}</div>
                      </div>
                      <div className="text-end shrink-0"><div className="font-bold num">{money(d.amount_iqd)}</div>{d.currency === 'USD' && <div className="text-xs text-ink-500 num">${num(d.amount)}</div>}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          ) : !exps.length ? <div className="card"><Empty icon={ShoppingCart} title="ماكو مصروفات" text="سجّل المشتريات والمساعدات مع صورة الفاتورة." /></div> : (
            <ul className="card divide-y divide-ink-100">
              {exps.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="size-10 rounded-xl bg-gold-100 text-gold-700 grid place-items-center shrink-0"><FileText className="size-5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.description}</div>
                    <div className="text-sm text-ink-500">{EXPENSE_KIND[e.kind]} · {fundName(e.fund_id)} · {dateShort(e.created_at)}{e.vendor ? ` · ${e.vendor}` : ''}</div>
                  </div>
                  {e.invoice_path && <button className="size-9 grid place-items-center rounded-lg hover:bg-ink-100 shrink-0" onClick={() => openInvoice(e.invoice_path!)} aria-label="عرض الفاتورة"><Paperclip className="size-4" /></button>}
                  <div className="text-end shrink-0"><div className="font-bold num">{money(e.amount_iqd)}</div><span className={`chip ${EXPENSE_STATUS[e.status].cls}`}>{EXPENSE_STATUS[e.status].label}</span></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
