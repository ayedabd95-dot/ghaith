import { useState } from 'react';
import { ClipboardCheck, Check, X, Paperclip } from 'lucide-react';
import { supabase, errText, type Expense } from '../lib/supabase';
import { money, EXPENSE_KIND, dateAr, PURPOSE } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, Empty, ErrorBox, useToast, Confirm } from '../components/ui';

type Row = Expense & { ch_funds: { name: string } | null; ch_profiles: { full_name: string } | null };

export default function Approvals() {
  const toast = useToast();
  const [ask, setAsk] = useState<{ row: Row; to: 'approved' | 'rejected' } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(async () => {
    const { data, error } = await supabase.from('ch_expenses').select('*, ch_funds(name)').eq('status', 'pending').order('created_at');
    if (error) throw error;
    const ids = [...new Set((data ?? []).map((r) => r.created_by).filter(Boolean))];
    const { data: ppl } = ids.length ? await supabase.from('ch_profiles').select('id,full_name').in('id', ids) : { data: [] };
    return (data ?? []).map((r) => ({ ...r, ch_profiles: ppl?.find((p) => p.id === r.created_by) ?? null })) as Row[];
  });

  const decide = async () => {
    if (!ask) return;
    setBusy(true);
    const { error } = await supabase.from('ch_expenses').update({ status: ask.to }).eq('id', ask.row.id);
    setBusy(false); setAsk(null);
    if (error) toast({ kind: 'err', text: errText(error) });
    else { toast({ kind: 'ok', text: ask.to === 'approved' ? 'تمت الموافقة وانخصم المبلغ من الصندوق' : 'انرفض المصروف' }); reload(); }
  };
  const openInvoice = async (path: string) => {
    const { data: s } = await supabase.storage.from('ch-invoices').createSignedUrl(path, 300);
    if (s) window.open(s.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="الموافقات" sub="مصروفات فوق حد الموافقة تنتظر قرارك" icon={ClipboardCheck} />
      {error ? <ErrorBox text="تعذر التحميل" retry={reload} /> : loading || !data ? <ListSkeleton /> : !data.length ? (
        <div className="card"><Empty icon={Check} title="ماكو شي بالانتظار" text="كل المصروفات معتمدة. أي مصروف كبير راح يطلع هنا." /></div>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[17px]">{r.description}</div>
                  <div className="text-sm text-ink-500 mt-1">{EXPENSE_KIND[r.kind]} · {r.ch_funds?.name} · {PURPOSE[r.purpose]}{r.vendor ? ` · ${r.vendor}` : ''}</div>
                  <div className="text-sm text-ink-500">طلبه {r.ch_profiles?.full_name ?? '—'} · {dateAr(r.created_at)}</div>
                </div>
                <div className="text-xl font-bold num shrink-0">{money(r.amount_iqd)}</div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button className="btn-primary flex-1" onClick={() => setAsk({ row: r, to: 'approved' })}><Check className="size-5" />موافقة</button>
                <button className="btn-ghost flex-1 text-red-700" onClick={() => setAsk({ row: r, to: 'rejected' })}><X className="size-5" />رفض</button>
                {r.invoice_path && <button className="btn-ghost" onClick={() => openInvoice(r.invoice_path!)}><Paperclip className="size-5" />الفاتورة</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Confirm open={!!ask} onClose={() => setAsk(null)} busy={busy} danger={ask?.to === 'rejected'}
        title={ask?.to === 'approved' ? 'تأكيد الموافقة' : 'تأكيد الرفض'} confirmLabel={ask?.to === 'approved' ? 'وافق واخصم' : 'ارفض'} onConfirm={decide}
        text={ask && (ask.to === 'approved'
          ? <>راح ينصرف <b className="num">{money(ask.row.amount_iqd)}</b> من <b>{ask.row.ch_funds?.name}</b> على «{ask.row.description}».</>
          : <>راح ينرفض مصروف «{ask.row.description}» وما ينخصم شي.</>)} />
    </div>
  );
}
