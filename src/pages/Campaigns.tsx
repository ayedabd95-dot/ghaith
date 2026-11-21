import { Link } from 'react-router-dom';
import { Truck, Plus } from 'lucide-react';
import { supabase, type Campaign } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { CAMPAIGN_KIND, num, pct, dateAr } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, Empty, ErrorBox, Ring } from '../components/ui';

export default function Campaigns() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useLoad(async () => {
    const [c, d] = await Promise.all([
      supabase.from('ch_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('ch_distributions').select('campaign_id,status'),
    ]);
    if (c.error) throw c.error;
    return { camps: c.data as Campaign[], dists: d.data ?? [] };
  });

  return (
    <div>
      <PageHeader title="الحملات والتوزيع" sub="كل حملة لها قائمة عوائل، والنظام يبين منو استلم ومنو بقى" icon={Truck}
        actions={can('admin') && <Link to="/campaigns/new" className="btn-primary"><Plus className="size-5" />حملة جديدة</Link>} />
      {error ? <ErrorBox text="تعذر التحميل" retry={reload} /> : loading || !data ? <ListSkeleton /> : !data.camps.length ? (
        <div className="card"><Empty icon={Truck} title="ماكو حملات بعد" text="سوّ حملة (سلات، مساعدة نقدية، كفالة) واختار العوائل حسب الأولوية." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.camps.map((c) => {
            const ds = data.dists.filter((d) => d.campaign_id === c.id);
            const done = ds.filter((d) => d.status === 'delivered').length;
            const p = pct(done, ds.length);
            return (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="lift card p-4 flex items-center gap-4">
                <Ring value={p} size={88} stroke={9}><span className="font-bold num">{p}%</span></Ring>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className={`chip ${c.status === 'active' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700'}`}>{c.status === 'active' ? 'نشطة' : 'منتهية'}</span><span className="text-xs text-ink-500">{CAMPAIGN_KIND[c.kind]}</span></div>
                  <div className="font-bold mt-1">{c.name}</div>
                  <div className="text-sm text-ink-500 mt-0.5"><span className="num">{num(done)}</span> من <span className="num">{num(ds.length)}</span> عائلة استلمت</div>
                  <div className="text-xs text-ink-500">من {dateAr(c.starts_on)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
