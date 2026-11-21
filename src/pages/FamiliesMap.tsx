import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TIER, num } from '../lib/format';
import { useLoad, PageHeader, Skeleton, ErrorBox } from '../components/ui';
import { FamilyMap, type MapFamily } from '../components/Maps';

export default function FamiliesMap() {
  const [tiers, setTiers] = useState(['A', 'B', 'C']);
  const { data, loading, error, reload } = useLoad(async () => {
    const { data, error } = await supabase.from('ch_families').select('id,head_name,lat,lng,tier,neighborhood,code').eq('status', 'active');
    if (error) throw error;
    return data as MapFamily[];
  });
  const shown = (data ?? []).filter((f) => tiers.includes(f.tier));
  return (
    <div>
      <PageHeader title="خريطة العوائل" sub={data ? `${num(shown.length)} عائلة نشطة على الخريطة` : undefined} icon={MapIcon} />
      <div className="flex flex-wrap gap-2 mb-3">
        {(['A', 'B', 'C'] as const).map((t) => (
          <label key={t} className={`flex items-center gap-2 rounded-xl border px-3 h-11 cursor-pointer bg-white ${tiers.includes(t) ? 'border-brand-600 font-semibold' : 'border-ink-200 opacity-60'}`}>
            <input type="checkbox" className="sr-only" checked={tiers.includes(t)} onChange={() => setTiers(tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t])} />
            <span className={`size-3 rounded-full ${TIER[t].dot}`} />{TIER[t].short} — {TIER[t].label} <span className="num text-ink-500">({num((data ?? []).filter((f) => f.tier === t).length)})</span>
          </label>
        ))}
      </div>
      {error ? <ErrorBox text="تعذر تحميل الخريطة" retry={reload} /> : loading ? <Skeleton className="h-[70vh]" /> : <FamilyMap families={shown} height="calc(100vh - 260px)" />}
    </div>
  );
}
