import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Printer, MessageCircle } from 'lucide-react';
import { supabase, type Donation } from '../lib/supabase';
import { money, METHOD, PURPOSE, dateAr, num } from '../lib/format';
import { useLoad, ListSkeleton, ErrorBox } from '../components/ui';

export default function Receipt() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = useLoad(async () => {
    const { data, error } = await supabase.from('ch_donations').select('*, ch_funds(name)').eq('id', id!).single();
    if (error) throw error;
    return data as Donation & { ch_funds: { name: string } | null };
  }, [id]);
  if (error) return <ErrorBox text="ما لكينا الوصل" />;
  if (loading || !data) return <ListSkeleton />;
  const d = data;
  const wa = d.donor_phone
    ? `https://wa.me/964${d.donor_phone.slice(1)}?text=${encodeURIComponent(`السلام عليكم ${d.donor_name}،\nاستلمت مؤسسة الرحمة الخيرية تبرعكم بمبلغ ${money(d.amount_iqd)}${d.currency === 'USD' ? ` ($${num(d.amount)})` : ''}.\nرقم الوصل: ${d.receipt_no}\nالتاريخ: ${dateAr(d.created_at)}\nجزاكم الله خيراً، وراح نبعثلكم تقرير بأثر تبرعكم.`)}`
    : null;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4 no-print">
        <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <h1 className="text-xl font-bold flex-1">وصل استلام تبرع</h1>
      </div>
      <div className="card p-6 print-full">
        <div className="flex items-center justify-between border-b border-ink-200 pb-4">
          <div className="flex items-center gap-3"><img src={`${import.meta.env.BASE_URL}logo.svg`} width={48} height={48} alt="" className="rounded-xl" />
            <div><div className="font-bold">مؤسسة الرحمة الخيرية</div><div className="text-xs text-ink-500">للرعاية والتنمية المجتمعية</div></div></div>
          <div className="text-end"><div className="text-xs text-ink-500">رقم الوصل</div><div className="text-2xl font-bold num">#{d.receipt_no}</div></div>
        </div>
        <dl className="divide-y divide-ink-100 text-[15px]">
          {[
            ['التاريخ', dateAr(d.created_at)], ['استلمنا من', d.donor_name],
            ['المبلغ', <b className="num">{d.currency === 'USD' ? `$${num(d.amount)} (${money(d.amount_iqd)})` : money(d.amount_iqd)}</b>],
            ['الطريقة', METHOD[d.method]], ['الصندوق', d.ch_funds?.name ?? ''], ['الغرض', PURPOSE[d.purpose]],
            ...(d.txn_ref ? [['رقم العملية', <span className="num">{d.txn_ref}</span>]] : []),
          ].map(([k, v], i) => <div key={i} className="grid grid-cols-[8rem_1fr] py-3"><dt className="text-ink-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}
        </dl>
        <p className="mt-4 text-center text-sm text-ink-500">جزاكم الله خيراً. هذا الوصل صادر من نظام المؤسسة ومسجل بسجل الحسابات.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 no-print">
        <button className="btn-ghost" onClick={() => window.print()}><Printer className="size-5" />طباعة</button>
        {wa ? <a className="btn-primary" href={wa} target="_blank" rel="noreferrer"><MessageCircle className="size-5" />إرسال بالواتساب</a>
          : <button className="btn-primary" disabled title="ماكو رقم هاتف للمتبرع"><MessageCircle className="size-5" />إرسال بالواتساب</button>}
      </div>
    </div>
  );
}
