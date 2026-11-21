import { History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dateAr, money } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Empty } from '../components/ui';

const ENTITY: Record<string, string> = { ch_families: 'عائلة', ch_donations: 'تبرع', ch_expenses: 'مصروف', ch_distributions: 'توزيع', ch_campaigns: 'حملة', ch_profiles: 'عضو فريق' };
const ACTION: Record<string, string> = { insert: 'إضافة', update: 'تعديل', delete: 'حذف' };
const STATUS_AR: Record<string, string> = { delivered: 'استلمت', not_delivered: 'لم تستلم', scheduled: 'باقية', approved: 'معتمد', pending: 'بانتظار الموافقة', rejected: 'مرفوض' };
const prettify = (s: string | null) => (s ?? '').replace(/\b\d{4,}\b/g, (n) => money(Number(n))).replace(/\b(delivered|not_delivered|scheduled|approved|pending|rejected)\b/g, (m) => STATUS_AR[m]);

export default function Activity() {
  const { data, loading, error, reload } = useLoad(async () => {
    const [a, p] = await Promise.all([
      supabase.from('ch_activity').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('ch_profiles').select('id,full_name'),
    ]);
    if (a.error) throw a.error;
    return { rows: a.data ?? [], people: p.data ?? [] };
  });
  const who = (id: string | null) => data?.people.find((p) => p.id === id)?.full_name ?? 'النظام';
  return (
    <div className="max-w-4xl">
      <PageHeader title="سجل النشاطات" sub="كل إضافة وتعديل وحذف ينسجل باسم صاحبه ووقته، وما ينمسح" icon={History} />
      {error ? <ErrorBox text="تعذر التحميل" retry={reload} /> : loading || !data ? <ListSkeleton rows={8} /> : !data.rows.length ? <div className="card"><Empty icon={History} title="السجل فارغ" text="أول ما الفريق يشتغل تطلع الحركات هنا." /></div> : (
        <ul className="card divide-y divide-ink-100">
          {data.rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`chip shrink-0 mt-0.5 ${r.action === 'delete' ? 'bg-red-50 text-red-700' : r.action === 'insert' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700'}`}>{ACTION[r.action]}</span>
              <div className="flex-1 min-w-0 text-[15px]"><b>{who(r.actor)}</b> — {ENTITY[r.entity] ?? r.entity}: {prettify(r.summary)}</div>
              <span className="text-sm text-ink-500 shrink-0">{dateAr(r.created_at)} <span className="num">{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
