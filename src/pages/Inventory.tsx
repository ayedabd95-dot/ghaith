import { useState } from 'react';
import { Package, Plus, Minus, PackagePlus, AlertTriangle } from 'lucide-react';
import { supabase, errText, type Item } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { num, timeAgo } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Empty, Modal, Field, useToast, Section, Progress } from '../components/ui';

export default function Inventory() {
  const { can } = useAuth();
  const toast = useToast();
  const edit = can('admin', 'warehouse');
  const [move, setMove] = useState<{ item: Item; dir: 1 | -1 } | null>(null);
  const [qty, setQty] = useState(''); const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ name: '', unit: 'كغم', min_qty: '' });
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useLoad(async () => {
    const [i, m] = await Promise.all([
      supabase.from('ch_items').select('*').order('name'),
      supabase.from('ch_item_moves').select('id,delta,reason,created_at,item_id').order('created_at', { ascending: false }).limit(30),
    ]);
    if (i.error) throw i.error;
    return { items: i.data as Item[], moves: m.data ?? [] };
  });

  const saveMove = async () => {
    const n = Number(qty);
    if (!move || !(n > 0)) return;
    setBusy(true);
    const { error } = await supabase.from('ch_item_moves').insert({ item_id: move.item.id, delta: n * move.dir, reason: reason.trim() || (move.dir > 0 ? 'إضافة للمخزن' : 'صرف من المخزن') });
    setBusy(false);
    if (error) { toast({ kind: 'err', text: errText(error) }); return; }
    toast({ kind: 'ok', text: `${move.dir > 0 ? 'انضاف' : 'انصرف'} ${num(n)} ${move.item.unit} ${move.item.name}` });
    setMove(null); setQty(''); setReason(''); reload();
  };
  const saveItem = async () => {
    if (!nv.name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from('ch_items').insert({ name: nv.name.trim(), unit: nv.unit.trim() || 'قطعة', min_qty: Number(nv.min_qty) || 0 });
    setBusy(false);
    if (error) { toast({ kind: 'err', text: errText(error) }); return; }
    setAdding(false); setNv({ name: '', unit: 'كغم', min_qty: '' }); reload();
  };
  const itemName = (id: string) => data?.items.find((i) => i.id === id);

  return (
    <div>
      <PageHeader title="المخزون والسلات" sub="الكمية تنقص لوحدها كل ما الموزع يأكد تسليم سلة" icon={Package}
        actions={edit && <button className="btn-primary" onClick={() => setAdding(true)}><PackagePlus className="size-5" />مادة جديدة</button>} />
      {error ? <ErrorBox text="تعذر تحميل المخزون" retry={reload} /> : loading || !data ? <ListSkeleton /> : !data.items.length ? (
        <div className="card"><Empty icon={Package} title="المخزن فارغ" text="ضيف المواد (طحين، رز، زيت…) حتى تكدر تسوي وصفة السلة." /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3 content-start">
            {data.items.map((i) => {
              const low = Number(i.qty) < Number(i.min_qty);
              const ratio = i.min_qty > 0 ? (Number(i.qty) / (Number(i.min_qty) * 3)) * 100 : 100;
              return (
                <div key={i.id} className={`card p-4 ${low ? 'border-red-300' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div><div className="font-bold text-[17px]">{i.name}</div>
                      <div className="text-2xl font-bold mt-1"><span className="num">{num(i.qty)}</span> <span className="text-sm font-medium text-ink-500">{i.unit}</span></div></div>
                    {low && <span className="chip bg-red-50 text-red-700"><AlertTriangle className="size-3.5" />منخفض</span>}
                  </div>
                  <div className="mt-3"><Progress value={ratio} tone={low ? 'bg-red-500' : 'bg-brand-600'} /></div>
                  <div className="text-xs text-ink-500 mt-1">الحد الأدنى: <span className="num">{num(i.min_qty)}</span> {i.unit}</div>
                  {edit && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button className="btn-ghost btn-sm" onClick={() => setMove({ item: i, dir: 1 })}><Plus className="size-4" />إضافة</button>
                      <button className="btn-ghost btn-sm" onClick={() => setMove({ item: i, dir: -1 })}><Minus className="size-4" />صرف</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Section title="آخر الحركات">
            <ul className="divide-y divide-ink-100 -mx-1">
              {data.moves.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-1 py-2.5 text-sm">
                  <span className={`font-bold num w-16 shrink-0 ${Number(m.delta) > 0 ? 'text-brand-700' : 'text-red-700'}`}>{Number(m.delta) > 0 ? '+' : ''}{num(m.delta)}</span>
                  <span className="flex-1"><b>{itemName(m.item_id)?.name}</b> · {m.reason}</span>
                  <span className="text-ink-500 shrink-0">{timeAgo(m.created_at)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <Modal open={!!move} onClose={() => setMove(null)} title={move ? `${move.dir > 0 ? 'إضافة' : 'صرف'} — ${move.item.name}` : ''}>
        <div className="space-y-4">
          <Field label={`الكمية (${move?.item.unit})`} required><input className="input text-left text-lg" dir="ltr" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
          <Field label="السبب"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={move?.dir === 1 ? 'شراء / تبرع عيني من تاجر' : 'تالف / صرف لعائلة'} /></Field>
          <button className="btn-primary w-full" disabled={busy || !(Number(qty) > 0)} onClick={saveMove}>حفظ</button>
        </div>
      </Modal>
      <Modal open={adding} onClose={() => setAdding(false)} title="مادة جديدة">
        <div className="space-y-4">
          <Field label="اسم المادة" required><input className="input" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} placeholder="مثلاً: حمص" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الوحدة"><input className="input" value={nv.unit} onChange={(e) => setNv({ ...nv, unit: e.target.value })} /></Field>
            <Field label="الحد الأدنى للتنبيه"><input className="input text-left" dir="ltr" inputMode="numeric" value={nv.min_qty} onChange={(e) => setNv({ ...nv, min_qty: e.target.value })} /></Field>
          </div>
          <button className="btn-primary w-full" disabled={busy || !nv.name.trim()} onClick={saveItem}>إضافة المادة</button>
        </div>
      </Modal>
    </div>
  );
}
