import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, ChevronRight, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase, errText, type Family, type Item, type Profile } from '../lib/supabase';
import { CAMPAIGN_KIND, TIER, CATEGORIES, num, money } from '../lib/format';
import { useLoad, Field, useToast, ListSkeleton } from '../components/ui';

export default function CampaignForm() {
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading } = useLoad(async () => {
    const [f, i, p, d] = await Promise.all([
      supabase.from('ch_families').select('id,head_name,tier,score,categories,lat,lng,status').eq('status', 'active'),
      supabase.from('ch_items').select('*').order('name'),
      supabase.from('ch_profiles').select('*').eq('active', true).or('role.eq.distributor,and(role.eq.volunteer,perms.cs.{distribute})'),
      supabase.from('ch_distributions').select('family_id,delivered_at').not('delivered_at', 'is', null),
    ]);
    return { fams: (f.data ?? []) as Family[], items: (i.data ?? []) as Item[], dists: (p.data ?? []) as Profile[], recent: d.data ?? [] };
  });
  const [v, setV] = useState({ name: '', kind: 'food_basket', description: '', cash: '' });
  const [basket, setBasket] = useState<{ item_id: string; qty: string }[]>([]);
  const [tiers, setTiers] = useState<string[]>(['A', 'B']);
  const [cat, setCat] = useState('');
  const [skipDays, setSkipDays] = useState('0');
  const [limit, setLimit] = useState('');
  const [pickedDist, setPickedDist] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const targets = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - Number(skipDays) * 86_400_000;
    const recentIds = new Set(data.recent.filter((r) => Number(skipDays) > 0 && new Date(r.delivered_at!).getTime() > cutoff).map((r) => r.family_id));
    const list = data.fams.filter((f) => tiers.includes(f.tier) && (!cat || f.categories.includes(cat)) && !recentIds.has(f.id)).sort((a, b) => b.score - a.score);
    return Number(limit) > 0 ? list.slice(0, Number(limit)) : list;
  }, [data, tiers, cat, skipDays, limit]);

  const usesBasket = v.kind === 'food_basket' || v.kind === 'winter';
  const shortages = usesBasket && data ? basket.filter((b) => b.item_id && Number(b.qty) > 0).map((b) => {
    const it = data.items.find((i) => i.id === b.item_id)!;
    const need = Number(b.qty) * targets.length;
    return { it, need, short: need - Number(it.qty) };
  }).filter((x) => x.short > 0) : [];

  const submit = async () => {
    setErr('');
    if (!v.name.trim()) return setErr('اكتب اسم الحملة');
    if (!targets.length) return setErr('ماكو عوائل تطابق الاختيار');
    if (usesBasket && !basket.some((b) => b.item_id && Number(b.qty) > 0)) return setErr('حدد محتوى السلة');
    if (!usesBasket && !(Number(v.cash) > 0) && v.kind !== 'other') return setErr('اكتب مبلغ المساعدة لكل عائلة');
    setBusy(true);
    try {
      const { data: c, error } = await supabase.from('ch_campaigns').insert({
        name: v.name.trim(), kind: v.kind, description: v.description.trim() || null,
        basket: usesBasket ? basket.filter((b) => b.item_id && Number(b.qty) > 0).map((b) => ({ item_id: b.item_id, qty: Number(b.qty) })) : [],
        cash_per_family: usesBasket ? 0 : Number(v.cash) || 0,
      }).select('id').single();
      if (error) throw error;
      // Split families between distributors by area: sort by longitude, then hand out contiguous chunks.
      const sorted = [...targets].sort((a, b) => (a.lng ?? 0) - (b.lng ?? 0) || (a.lat ?? 0) - (b.lat ?? 0));
      const n = pickedDist.length;
      const chunk = n ? Math.ceil(sorted.length / n) : sorted.length;
      const rows = sorted.map((f, i) => ({ campaign_id: c.id, family_id: f.id, distributor_id: n ? pickedDist[Math.floor(i / chunk)] : null }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error: e2 } = await supabase.from('ch_distributions').insert(rows.slice(i, i + 500));
        if (e2) throw e2;
      }
      toast({ kind: 'ok', text: `انسوت الحملة لـ ${num(rows.length)} عائلة` });
      nav(`/campaigns/${c.id}`, { replace: true });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  if (loading || !data) return <ListSkeleton />;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><Truck className="size-6" /></span>
        <h1 className="text-xl font-bold">حملة جديدة</h1>
      </div>

      <div className="card p-4 lg:p-5 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><Field label="اسم الحملة" required><input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="مثلاً: سلات رمضان 1448" /></Field></div>
        <Field label="نوع الحملة"><select className="input" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(CAMPAIGN_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {!usesBasket && <Field label="المبلغ لكل عائلة (د.ع)"><input className="input text-left" dir="ltr" inputMode="numeric" value={v.cash} onChange={(e) => setV({ ...v, cash: e.target.value.replace(/[^\d]/g, '') })} /></Field>}
        <div className="sm:col-span-2"><Field label="وصف (اختياري)"><input className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field></div>
      </div>

      {usesBasket && (
        <div className="card p-4 lg:p-5">
          <h2 className="font-bold text-[17px] mb-3">محتوى السلة الوحدة</h2>
          <div className="space-y-2">
            {basket.map((b, i) => (
              <div key={i} className="flex gap-2">
                <select className="input flex-1" value={b.item_id} onChange={(e) => setBasket(basket.map((x, j) => (j === i ? { ...x, item_id: e.target.value } : x)))} aria-label="المادة">
                  <option value="">اختار مادة…</option>
                  {data.items.map((it) => <option key={it.id} value={it.id} disabled={basket.some((x, j) => j !== i && x.item_id === it.id)}>{it.name} ({it.unit})</option>)}
                </select>
                <input className="input w-24 text-left" dir="ltr" inputMode="decimal" value={b.qty} placeholder="الكمية" aria-label="الكمية" onChange={(e) => setBasket(basket.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                <button className="size-12 grid place-items-center rounded-xl hover:bg-ink-100 shrink-0" onClick={() => setBasket(basket.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 className="size-5" /></button>
              </div>
            ))}
          </div>
          <button className="btn-ghost btn-sm mt-3" onClick={() => setBasket([...basket, { item_id: '', qty: '' }])}><Plus className="size-4" />أضف مادة</button>
        </div>
      )}

      <div className="card p-4 lg:p-5 space-y-4">
        <h2 className="font-bold text-[17px]">منو ياخذ؟</h2>
        <div>
          <span className="field-label">الفئات</span>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B', 'C'] as const).map((t) => (
              <label key={t} className={`flex items-center gap-2 rounded-xl border px-3 h-11 cursor-pointer ${tiers.includes(t) ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200'}`}>
                <input type="checkbox" className="size-5 accent-brand-700" checked={tiers.includes(t)} onChange={() => setTiers(tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t])} />
                {TIER[t].short} — {TIER[t].label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="نوع الحالة"><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">الكل</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
          <Field label="استثني اللي استلمت خلال"><select className="input" value={skipDays} onChange={(e) => setSkipDays(e.target.value)}><option value="0">لا تستثني</option><option value="15">15 يوم</option><option value="30">30 يوم</option><option value="60">60 يوم</option></select></Field>
          <Field label="أقصى عدد عوائل" hint="الأعلى درجة أولاً"><input className="input text-left" dir="ltr" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))} placeholder="الكل" /></Field>
        </div>
        {!!data.dists.length && (
          <div>
            <span className="field-label">الموزّعون (ينقسمون العوائل حسب المنطقة)</span>
            <div className="flex flex-wrap gap-2">
              {data.dists.map((p) => (
                <label key={p.id} className={`flex items-center gap-2 rounded-xl border px-3 h-11 cursor-pointer ${pickedDist.includes(p.id) ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-ink-200'}`}>
                  <input type="checkbox" className="size-5 accent-brand-700" checked={pickedDist.includes(p.id)} onChange={() => setPickedDist(pickedDist.includes(p.id) ? pickedDist.filter((x) => x !== p.id) : [...pickedDist, p.id])} />{p.full_name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-4 lg:p-5">
        <div className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="size-6 text-brand-600" /><span className="num">{num(targets.length)}</span> عائلة راح تدخل بالحملة</div>
        {!usesBasket && Number(v.cash) > 0 && <p className="text-ink-700 mt-1">المجموع المتوقع: <b className="num">{money(Number(v.cash) * targets.length)}</b></p>}
        {shortages.map((s) => (
          <p key={s.it.id} className="flex items-center gap-2 text-amber-800 mt-2 text-[15px]"><AlertTriangle className="size-4 shrink-0" />{s.it.name}: تحتاج <span className="num">{num(s.need)}</span> {s.it.unit} والمتوفر <span className="num">{num(s.it.qty)}</span> — ناقص <span className="num">{num(s.short)}</span></p>
        ))}
      </div>
      {err && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 font-medium" role="alert">{err}</div>}
      <button className="btn-primary w-full h-12" disabled={busy} onClick={submit}>{busy ? 'جاري الإنشاء…' : 'إنشاء الحملة وتوزيع القوائم'}</button>
    </div>
  );
}
