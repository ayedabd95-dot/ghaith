import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Truck, ScanLine, Phone, Navigation, CheckCircle2, XCircle, MapPin, Keyboard } from 'lucide-react';
import { supabase, errText } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { num, TIER } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, Empty, ErrorBox, Modal, useToast, Tabs, Field } from '../components/ui';

type Row = { id: string; status: string; campaign_id: string; ch_campaigns: { name: string; basket: { item_id: string; qty: number }[]; cash_per_family: number; status: string } | null;
  ch_families: { id: string; head_name: string; phone: string; neighborhood: string; landmark: string; lat: number | null; lng: number | null; tier: string; code: string } };

const dist = (a: [number, number], b: [number, number]) => {
  const R = 6371, dLat = ((b[0] - a[0]) * Math.PI) / 180, dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export default function RoutePage() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const [me, setMe] = useState<[number, number] | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [fail, setFail] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [scan, setScan] = useState(sp.get('scan') === '1');
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useLoad(async () => {
    let qy = supabase.from('ch_distributions').select('id,status,campaign_id,ch_campaigns!inner(name,basket,cash_per_family,status),ch_families(id,head_name,phone,neighborhood,landmark,lat,lng,tier,code)').eq('ch_campaigns.status', 'active');
    if (!can('admin')) qy = qy.eq('distributor_id', profile!.id);
    const [r, i] = await Promise.all([qy, supabase.from('ch_items').select('id,name,unit')]);
    if (r.error) throw r.error;
    return { rows: (r.data ?? []) as unknown as Row[], items: i.data ?? [] };
  });

  useEffect(() => { navigator.geolocation?.getCurrentPosition((p) => setMe([p.coords.latitude, p.coords.longitude]), () => {}, { timeout: 10000 }); }, []);

  const todo = useMemo(() => {
    const l = (data?.rows ?? []).filter((r) => r.status === 'scheduled');
    if (me) l.sort((a, b) => (a.ch_families.lat ? dist(me, [a.ch_families.lat, a.ch_families.lng!]) : 999) - (b.ch_families.lat ? dist(me, [b.ch_families.lat, b.ch_families.lng!]) : 999));
    return l;
  }, [data, me]);
  const done = (data?.rows ?? []).filter((r) => r.status !== 'scheduled');

  const setStatus = async (r: Row, status: 'delivered' | 'not_delivered', why?: string) => {
    setBusy(true);
    const { error } = await supabase.from('ch_distributions').update({ status, reason: why ?? null, lat: me?.[0] ?? null, lng: me?.[1] ?? null }).eq('id', r.id);
    setBusy(false);
    if (error) { toast({ kind: 'err', text: errText(error) }); return false; }
    toast({ kind: 'ok', text: status === 'delivered' ? `تم التسليم لـ ${r.ch_families.head_name}` : 'انسجلت كـ «لم تستلم»',
      action: { label: 'تراجع', run: async () => { await supabase.from('ch_distributions').update({ status: 'scheduled', reason: null }).eq('id', r.id); reload(); } } });
    reload();
    return true;
  };

  const onCode = (code: string) => {
    const c = code.trim().toUpperCase();
    const row = data?.rows.find((r) => r.ch_families.code.toUpperCase() === c);
    setScan(false); setSp({}, { replace: true });
    if (!row) { toast({ kind: 'err', text: `الرمز ${c} مو ضمن قائمتك` }); return; }
    if (row.status === 'delivered') { toast({ kind: 'err', text: `${row.ch_families.head_name} استلمت من قبل بهذي الحملة` }); return; }
    setConfirm(row);
  };

  const basketText = (r: Row) => {
    const c = r.ch_campaigns;
    if (!c) return '';
    if (c.cash_per_family > 0) return `مبلغ ${num(c.cash_per_family)} د.ع`;
    return c.basket.map((b) => { const it = data?.items.find((i) => i.id === b.item_id); return it ? `${b.qty} ${it.unit} ${it.name}` : ''; }).filter(Boolean).join('، ');
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="مساري اليوم" sub={data ? `${num(todo.length)} عائلة باقية · ${num(done.length)} خلصت` : undefined} icon={Truck}
        actions={<button className="btn-primary" onClick={() => setScan(true)}><ScanLine className="size-5" />امسح QR</button>} />
      <div className="mb-3"><Tabs value={tab} onChange={setTab} items={[{ key: 'todo', label: `باقية (${todo.length})` }, { key: 'done', label: `خلصت (${done.length})` }]} /></div>
      {error ? <ErrorBox text="تعذر تحميل المسار" retry={reload} /> : loading ? <ListSkeleton /> : (tab === 'todo' ? todo : done).length === 0 ? (
        <div className="card"><Empty icon={CheckCircle2} title={tab === 'todo' ? 'خلصت كل العوائل' : 'ما سلّمت لأحد بعد'} text={tab === 'todo' ? 'ماكو عوائل باقية بمسارك. عاشت إيدك.' : 'العوائل اللي تسلمها تطلع هنا.'} /></div>
      ) : (
        <ul className="space-y-2">
          {(tab === 'todo' ? todo : done).map((r) => {
            const f = r.ch_families;
            const km = me && f.lat ? dist(me, [f.lat, f.lng!]) : null;
            return (
              <li key={r.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className={`size-10 rounded-xl grid place-items-center font-bold shrink-0 ${TIER[f.tier].cls}`}>{TIER[f.tier].short}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{f.head_name}</div>
                    <div className="text-sm text-ink-500 flex items-center gap-1"><MapPin className="size-3.5 shrink-0" />{f.neighborhood} — {f.landmark}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{r.ch_campaigns?.name} · {basketText(r)}</div>
                  </div>
                  {km !== null && <span className="text-sm font-bold text-brand-700 shrink-0 num">{km < 1 ? `${Math.round(km * 1000)} م` : `${km.toFixed(1)} كم`}</span>}
                </div>
                {tab === 'todo' ? (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <a href={`tel:${f.phone}`} className="btn-ghost btn-sm" aria-label={`اتصال بـ ${f.head_name}`}><Phone className="size-4" /></a>
                    {f.lat ? <a href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm" aria-label="ملاحة"><Navigation className="size-4" /></a> : <span />}
                    <button className="btn-ghost btn-sm text-red-700" onClick={() => { setFail(r); setReason(''); }}><XCircle className="size-4" />ما انلكت</button>
                    <button className="btn-primary btn-sm" onClick={() => setConfirm(r)}><CheckCircle2 className="size-4" />سلّمت</button>
                  </div>
                ) : <div className={`mt-2 chip ${r.status === 'delivered' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{r.status === 'delivered' ? 'استلمت' : 'لم تستلم'}</div>}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="تأكيد التسليم">
        {confirm && (<>
          <div className="text-center">
            <CheckCircle2 className="size-12 text-brand-600 mx-auto" />
            <div className="text-xl font-bold mt-2">{confirm.ch_families.head_name}</div>
            <div className="text-ink-500 num">{confirm.ch_families.code}</div>
            <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[15px]">{basketText(confirm)}</div>
          </div>
          <button className="btn-primary w-full h-12 mt-5" disabled={busy} onClick={async () => { if (await setStatus(confirm, 'delivered')) setConfirm(null); }}>تم التسليم</button>
        </>)}
      </Modal>
      <Modal open={!!fail} onClose={() => setFail(null)} title="العائلة ما استلمت">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{['البيت مسدود', 'ما يجاوبون على الهاتف', 'العنوان غلط', 'رفضوا الاستلام', 'انتقلوا'].map((x) => (
            <button key={x} className={`btn-sm btn ${reason === x ? 'bg-brand-700 text-white' : 'bg-white border border-ink-200'}`} onClick={() => setReason(x)}>{x}</button>
          ))}</div>
          <Field label="السبب" required><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn-danger w-full" disabled={busy || !reason.trim()} onClick={async () => { if (fail && await setStatus(fail, 'not_delivered', reason.trim())) setFail(null); }}>حفظ</button>
        </div>
      </Modal>
      <Modal open={scan} onClose={() => { setScan(false); setSp({}, { replace: true }); }} title="امسح بطاقة العائلة">
        {scan && <Scanner onCode={onCode} />}
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onCode(manual); }}>
          <div className="relative flex-1"><Keyboard className="size-5 absolute start-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input className="input ps-10 text-left" dir="ltr" placeholder="AR-00012" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="اكتب رمز العائلة" /></div>
          <button className="btn-primary">بحث</button>
        </form>
      </Modal>
    </div>
  );
}

function Scanner({ onCode }: { onCode: (c: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('جاري فتح الكاميرا…');
  const cb = useRef(onCode); cb.current = onCode;
  useEffect(() => {
    let stop: (() => Promise<void>) | null = null;
    let fired = false;
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!ref.current) return;
      const q = new Html5Qrcode(ref.current.id);
      q.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => { if (!fired) { fired = true; cb.current(text); } }, () => {})
        .then(() => { setMsg('وجّه الكاميرا على رمز QR بالبطاقة'); stop = () => q.stop(); })
        .catch(() => setMsg('ما كدرنا نفتح الكاميرا. اسمح للمتصفح بالكاميرا، أو اكتب الرمز تحت.'));
    });
    return () => { stop?.().catch(() => {}); };
  }, []);
  return (<>
    <div id="qr-reader" ref={ref} className="rounded-xl overflow-hidden bg-ink-900 min-h-[240px]" />
    <p className="text-sm text-ink-500 mt-2 text-center">{msg}</p>
  </>);
}
