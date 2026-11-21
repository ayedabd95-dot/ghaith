import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Truck, Download, Flag, Search } from 'lucide-react';
import { supabase, errText, type Campaign, type Profile } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { num, pct, DIST_STATUS, CAMPAIGN_KIND, dateAr, toCSV, money } from '../lib/format';
import { useLoad, ListSkeleton, ErrorBox, Ring, Tabs, useToast, Confirm, Section } from '../components/ui';
import { FamilyMap } from '../components/Maps';

type Row = { id: string; status: string; reason: string | null; delivered_at: string | null; distributor_id: string | null;
  ch_families: { id: string; head_name: string; phone: string; neighborhood: string; lat: number | null; lng: number | null; tier: string; code: string } };

export default function CampaignView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can } = useAuth();
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'delivered' | 'not_delivered'>('all');
  const [q, setQ] = useState('');
  const [closeAsk, setCloseAsk] = useState(false);
  const { data, loading, error, reload } = useLoad(async () => {
    const [c, d, p, i] = await Promise.all([
      supabase.from('ch_campaigns').select('*').eq('id', id!).single(),
      supabase.from('ch_distributions').select('id,status,reason,delivered_at,distributor_id,ch_families(id,head_name,phone,neighborhood,lat,lng,tier,code)').eq('campaign_id', id!),
      supabase.from('ch_profiles').select('id,full_name,role'),
      supabase.from('ch_items').select('id,name,unit'),
    ]);
    if (c.error) throw c.error;
    return { c: c.data as Campaign, rows: (d.data ?? []) as unknown as Row[], people: (p.data ?? []) as Profile[], items: i.data ?? [] };
  }, [id]);

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (filter === 'all' || r.status === filter) && (!q || r.ch_families.head_name.includes(q) || r.ch_families.neighborhood.includes(q))), [data, filter, q]);
  if (error) return <ErrorBox text="تعذر تحميل الحملة" retry={reload} />;
  if (loading || !data) return <ListSkeleton />;
  const { c } = data;
  const count = (s: string) => data.rows.filter((r) => r.status === s).length;
  const done = count('delivered');
  const who = (pid: string | null) => data.people.find((p) => p.id === pid)?.full_name ?? 'بدون موزّع';
  const byDist = [...new Set(data.rows.map((r) => r.distributor_id))].map((pid) => {
    const rs = data.rows.filter((r) => r.distributor_id === pid);
    return { pid, name: who(pid), total: rs.length, done: rs.filter((r) => r.status === 'delivered').length };
  });

  const close = async () => {
    const { error } = await supabase.from('ch_campaigns').update({ status: c.status === 'active' ? 'done' : 'active', ends_on: c.status === 'active' ? new Date().toISOString().slice(0, 10) : null }).eq('id', c.id);
    setCloseAsk(false);
    if (error) toast({ kind: 'err', text: errText(error) }); else reload();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100 shrink-0" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-bold">{c.name}</h1>
          <p className="text-sm text-ink-500">{CAMPAIGN_KIND[c.kind]} · من {dateAr(c.starts_on)}{c.cash_per_family > 0 && ` · ${money(c.cash_per_family)} لكل عائلة`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => toCSV(data.rows.map((r) => ({ الرمز: r.ch_families.code, العائلة: r.ch_families.head_name, الهاتف: r.ch_families.phone, الحي: r.ch_families.neighborhood, الموزع: who(r.distributor_id), الحالة: DIST_STATUS[r.status].label, 'تاريخ التسليم': r.delivered_at ? dateAr(r.delivered_at) : '', السبب: r.reason ?? '' })), `${c.name}.csv`)}><Download className="size-4" />Excel</button>
          {can('admin') && <button className="btn-ghost btn-sm" onClick={() => setCloseAsk(true)}><Flag className="size-4" />{c.status === 'active' ? 'إنهاء' : 'إعادة فتح'}</button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-5">
          <Ring value={pct(done, data.rows.length)} size={132} stroke={14}>
            <div><div className="text-3xl font-bold num">{num(done)}</div><div className="text-xs text-ink-500">من <span className="num">{num(data.rows.length)}</span> استلمت</div></div>
          </Ring>
          <ul className="flex-1 space-y-3 text-[15px]">
            {(['delivered', 'scheduled', 'not_delivered'] as const).map((s) => <li key={s} className="flex justify-between"><span className={`chip ${DIST_STATUS[s].cls}`}>{DIST_STATUS[s].label}</span><b className="num">{num(count(s))}</b></li>)}
          </ul>
        </div>
        <Section title="حسب الموزّع" icon={Truck}>
          <ul className="space-y-3">{byDist.map((d) => (
            <li key={d.pid ?? 'none'}><div className="flex justify-between text-[15px] mb-1"><span>{d.name}</span><span className="num font-bold">{d.done}/{d.total}</span></div>
              <div className="h-2 rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(d.done, d.total)}%` }} /></div></li>
          ))}</ul>
          {c.basket.length > 0 && <p className="text-sm text-ink-500 mt-4">السلة: {c.basket.map((b) => { const it = data.items.find((i) => i.id === b.item_id); return it ? `${b.qty} ${it.unit} ${it.name}` : ''; }).join('، ')}</p>}
        </Section>
        <FamilyMap colorBy="delivery" height={250} families={data.rows.map((r) => ({ ...r.ch_families, delivered: r.status === 'delivered' ? true : r.status === 'not_delivered' ? false : null }))} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Tabs value={filter} onChange={setFilter} items={[{ key: 'all', label: `الكل (${data.rows.length})` }, { key: 'scheduled', label: `باقية (${count('scheduled')})` }, { key: 'delivered', label: `استلمت (${done})` }, { key: 'not_delivered', label: `لم تستلم (${count('not_delivered')})` }]} />
        <div className="relative flex-1 min-w-[200px]"><Search className="size-5 absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" /><input className="input ps-10 h-10" placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث بالعوائل" /></div>
      </div>
      <ul className="card divide-y divide-ink-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <Link to={`/families/${r.ch_families.id}`} className="font-semibold hover:text-brand-700">{r.ch_families.head_name}</Link>
              <div className="text-sm text-ink-500">{r.ch_families.neighborhood} · {who(r.distributor_id)}{r.delivered_at ? ` · ${dateAr(r.delivered_at)}` : ''}{r.reason ? ` · ${r.reason}` : ''}</div>
            </div>
            <span className={`chip ${DIST_STATUS[r.status].cls}`}>{DIST_STATUS[r.status].label}</span>
          </li>
        ))}
        {!rows.length && <li className="p-8 text-center text-ink-500">ماكو عوائل بهذا الفلتر.</li>}
      </ul>
      <Confirm open={closeAsk} onClose={() => setCloseAsk(false)} title={c.status === 'active' ? 'إنهاء الحملة' : 'إعادة فتح الحملة'} confirmLabel="تأكيد" onConfirm={close}
        text={c.status === 'active' ? `باقي ${num(count('scheduled'))} عائلة ما استلمت. الحملة تختفي من الرئيسية بعد الإنهاء.` : 'الحملة ترجع نشطة وتطلع للموزعين.'} />
    </div>
  );
}
