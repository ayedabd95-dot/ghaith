import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ChevronRight, Phone, Navigation, Pencil, QrCode, Printer, PauseCircle, PlayCircle, Trash2, Gift, ClipboardCheck, Wallet } from 'lucide-react';
import { supabase, errText, type Family } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logoUrl } from '../lib/logo';
import { TIER, catLabel, BREADWINNER, HOUSING, money, num, dateAr, DIST_STATUS, EXPENSE_KIND, FAMILY_STATUS } from '../lib/format';
import { useLoad, Section, ListSkeleton, ErrorBox, Modal, Confirm, useToast, Tabs } from '../components/ui';
import { FamilyMap } from '../components/Maps';
import { StatusChip } from './Families';

function breakdown(f: Family) {
  const per = f.monthly_income / Math.max(f.members, 1);
  return [
    { l: 'الدخل لكل فرد', v: f.monthly_income <= 0 ? 30 : per < 50000 ? 20 : per < 100000 ? 10 : 0, max: 30 },
    { l: 'حالة المعيل', v: ({ deceased: 15, prisoner: 15, unable: 10, unemployed: 5 } as Record<string, number>)[f.breadwinner] ?? 0, max: 15 },
    { l: 'إعاقة أو مرض مزمن', v: Math.min(15, 5 * (f.disabled + f.chronic)), max: 15 },
    { l: 'عدد المعالين', v: Math.min(10, f.children + f.elderly), max: 10 },
    { l: 'السكن', v: ({ none: 10, encroach: 10, rent: 7 } as Record<string, number>)[f.housing] ?? 0, max: 10 },
    { l: 'الديون', v: f.debts <= 0 ? 0 : f.monthly_income <= 0 || f.debts >= f.monthly_income * 6 ? 10 : f.debts >= f.monthly_income * 2 ? 6 : 3, max: 10 },
    { l: 'ماكو مساعدة من جهة ثانية', v: f.other_aid ? 0 : 5, max: 5 },
    { l: 'تقدير الباحث', v: f.researcher_bonus, max: 5 },
  ];
}

export default function FamilyView() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { can, org } = useAuth();
  const [tab, setTab] = useState<'info' | 'aid'>('info');
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useLoad(async () => {
    const [f, d, e] = await Promise.all([
      supabase.from('ch_families').select('*').eq('id', id!).single(),
      supabase.from('ch_distributions').select('id,status,delivered_at,reason,created_at,ch_campaigns(name)').eq('family_id', id!).order('created_at', { ascending: false }),
      supabase.from('ch_expenses').select('id,amount_iqd,kind,description,status,created_at').eq('family_id', id!).order('created_at', { ascending: false }),
    ]);
    if (f.error) throw f.error;
    return { f: f.data as Family, dists: (d.data ?? []) as unknown as { id: string; status: string; delivered_at: string | null; reason: string | null; created_at: string; ch_campaigns: { name: string } | null }[], exps: e.data ?? [] };
  }, [id]);

  useEffect(() => { if (data?.f) QRCode.toDataURL(data.f.code, { margin: 1, width: 360, color: { dark: '#0b3a23' } }).then(setQr); }, [data?.f]);

  if (error) return <ErrorBox text="ما لكينا هذي العائلة" retry={reload} />;
  if (loading || !data) return <ListSkeleton rows={6} />;
  const { f, dists, exps } = data;
  const t = TIER[f.tier];

  const setStatus = async (status: string) => {
    setBusy(true);
    const { error } = await supabase.from('ch_families').update({ status }).eq('id', f.id);
    setBusy(false);
    if (error) toast({ kind: 'err', text: errText(error) }); else { toast({ kind: 'ok', text: `صارت حالة العائلة: ${FAMILY_STATUS[status]}` }); reload(); }
  };
  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from('ch_families').delete().eq('id', f.id);
    setBusy(false);
    if (error) toast({ kind: 'err', text: errText(error) }); else { toast({ kind: 'ok', text: 'انحذفت العائلة' }); nav('/families', { replace: true }); }
  };

  const info: [string, React.ReactNode][] = [
    ['رقم الهاتف', <span className="num">{f.phone}</span>], ['البطاقة الوطنية', f.national_id ? <span className="num">{f.national_id}</span> : '—'],
    ['العنوان', `${f.governorate} / ${f.district} / ${f.neighborhood}`], ['أقرب نقطة دالة', f.landmark],
    ['عدد الأفراد', num(f.members)], ['الأطفال', num(f.children)], ['الأيتام', num(f.orphans)], ['كبار السن', num(f.elderly)],
    ['ذوو الإعاقة', num(f.disabled)], ['أمراض مزمنة', num(f.chronic)], ['المعيل', BREADWINNER[f.breadwinner]],
    ['الدخل الشهري', money(f.monthly_income)], ['مصدر الدخل', f.income_source || '—'], ['السكن', HOUSING[f.housing] + (f.housing === 'rent' ? ` — ${money(f.rent)}` : '')],
    ['الديون', money(f.debts)], ['مساعدة من جهة ثانية', f.other_aid ? 'نعم' : 'لا'],
    ['المُبلّغ', f.reported_by_name ? `${f.reported_by_name}${f.reported_by_phone ? ' — ' + f.reported_by_phone : ''}` : '—'],
    ['تاريخ التسجيل', dateAr(f.created_at)], ['آخر تقييم', f.assessed_at ? dateAr(f.assessed_at) : 'ما انزارت بعد'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <button className="size-11 grid place-items-center rounded-xl hover:bg-ink-100 shrink-0" onClick={() => nav(-1)} aria-label="رجوع"><ChevronRight className="size-6" /></button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold">{f.head_name}</h1>
            <StatusChip s={f.status} />
            {f.status !== 'pending_visit' && <span className={`chip ${t.cls}`}>فئة {t.short} · {t.label}</span>}
          </div>
          <p className="text-sm text-ink-500 mt-1"><span className="num">{f.code}</span> · {f.neighborhood} · {f.categories.map(catLabel).join('، ')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`tel:${f.phone}`} className="btn-ghost btn-sm"><Phone className="size-4" />اتصال</a>
        {f.lat && <a href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><Navigation className="size-4" />ملاحة</a>}
        <button className="btn-ghost btn-sm" onClick={() => setQrOpen(true)}><QrCode className="size-4" />بطاقة العائلة</button>
        {can('admin', 'researcher') && <Link to={`/families/${f.id}/edit`} className="btn-ghost btn-sm"><Pencil className="size-4" />{f.status === 'pending_visit' ? 'زيارة وتقييم' : 'تعديل'}</Link>}
        {can('admin', 'accountant') && <Link to={`/finance/expense?family=${f.id}`} className="btn-ghost btn-sm"><Wallet className="size-4" />صرف مساعدة</Link>}
        {can('admin') && f.status === 'active' && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('inactive')}><PauseCircle className="size-4" />إيقاف</button>}
        {can('admin') && f.status === 'inactive' && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('active')}><PlayCircle className="size-4" />تفعيل</button>}
        {can('admin') && <button className="btn-ghost btn-sm text-red-700" onClick={() => setDel(true)}><Trash2 className="size-4" />حذف</button>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={tab} onChange={setTab} items={[{ key: 'info', label: 'البيانات' }, { key: 'aid', label: `المساعدات (${dists.length + exps.length})` }]} />
          {tab === 'info' ? (
            <div className="card divide-y divide-ink-100">
              {info.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9rem_1fr] sm:grid-cols-[12rem_1fr] gap-3 px-4 py-3 text-[15px]"><span className="text-ink-500">{k}</span><span className="font-medium">{v}</span></div>
              ))}
              {(f.researcher_note || f.notes) && (
                <div className="px-4 py-3 text-[15px] leading-7">
                  {f.researcher_note && <p><b>ملاحظة الباحث: </b>{f.researcher_note}</p>}
                  {f.notes && <p><b>ملاحظات: </b>{f.notes}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="card divide-y divide-ink-100">
              {!dists.length && !exps.length && <p className="p-8 text-center text-ink-500">ما استلمت العائلة أي مساعدة بعد.</p>}
              {dists.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <Gift className="size-5 text-brand-600 shrink-0" />
                  <div className="flex-1"><div className="font-semibold">{d.ch_campaigns?.name}</div>
                    <div className="text-sm text-ink-500">{d.delivered_at ? dateAr(d.delivered_at) : d.reason || ''}</div></div>
                  <span className={`chip ${DIST_STATUS[d.status].cls}`}>{DIST_STATUS[d.status].label}</span>
                </div>
              ))}
              {exps.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <Wallet className="size-5 text-gold-600 shrink-0" />
                  <div className="flex-1"><div className="font-semibold">{e.description}</div><div className="text-sm text-ink-500">{EXPENSE_KIND[e.kind]} · {dateAr(e.created_at)}</div></div>
                  <span className="font-bold num">{money(e.amount_iqd)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {f.status !== 'pending_visit' ? (
            <Section title="تفصيل التقييم" icon={ClipboardCheck}>
              <div className="flex items-center gap-3 mb-4">
                <span className={`size-14 rounded-2xl grid place-items-center text-2xl font-bold ${t.cls}`}>{t.short}</span>
                <div><div className="text-3xl font-bold num">{f.score}</div><div className="text-sm text-ink-500">من 100 درجة</div></div>
              </div>
              <ul className="space-y-2.5">
                {breakdown(f).map((b) => (
                  <li key={b.l} className="text-sm">
                    <div className="flex justify-between mb-1"><span>{b.l}</span><span className="font-bold num">{b.v} / {b.max}</span></div>
                    <div className="h-1.5 rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(b.v / b.max) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : (
            <div className="card p-5 bg-amber-50 border-amber-200">
              <div className="font-bold text-amber-900">العائلة بانتظار الزيارة</div>
              <p className="text-sm text-amber-900/80 mt-1 leading-6">الدرجة والفئة تطلع بعد ما الباحث يزورها ويعبي الاستمارة الكاملة.</p>
              {can('admin', 'researcher') && <Link to={`/families/${f.id}/edit`} className="btn-gold w-full mt-4">ابدأ الزيارة والتقييم</Link>}
            </div>
          )}
          {f.lat && <FamilyMap families={[f]} height={220} />}
        </div>
      </div>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="بطاقة العائلة">
        <div id="family-card" className="rounded-2xl border-2 border-brand-700 p-5 text-center">
          <div className="flex items-center justify-center gap-2 font-bold text-brand-800"><img src={logoUrl(org?.logo_path)} width={32} height={32} alt="" className="rounded-lg object-contain" />{org?.name}</div>
          {qr && <img src={qr} alt={`رمز QR للعائلة ${f.code}`} className="mx-auto mt-3 w-48 h-48" />}
          <div className="text-2xl font-bold mt-2 num">{f.code}</div>
          <div className="font-semibold mt-1">{f.head_name}</div>
          <p className="text-xs text-ink-500 mt-2">تُبرز هذه البطاقة عند استلام المساعدة</p>
        </div>
        <button className="btn-primary w-full mt-4" onClick={() => printCard(qr, f, org?.name ?? '')}><Printer className="size-5" />طباعة البطاقة</button>
      </Modal>
      <Confirm open={del} onClose={() => setDel(false)} danger busy={busy} title="حذف العائلة" confirmLabel="احذف نهائياً" onConfirm={remove}
        text={<>راح تنحذف <b>{f.head_name}</b> وكل سجل توزيعها. إذا تريد توقفها مؤقتاً استخدم «إيقاف» بدل الحذف.</>} />
    </div>
  );
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function printCard(qr: string, f: Family, orgName: string) {
  const w = window.open('', '_blank', 'width=420,height=600');
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقة ${esc(f.code)}</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
  <style>body{font-family:'IBM Plex Sans Arabic',sans-serif;display:grid;place-items:center;margin:0;padding:24px}
  .c{width:85mm;border:2px solid #145f39;border-radius:14px;padding:14px;text-align:center}
  h1{font-size:16px;color:#0b3a23;margin:0}img{width:44mm;height:44mm}.code{font-size:22px;font-weight:700;direction:ltr}
  p{margin:4px 0;font-size:13px}</style></head><body><div class="c"><h1>${esc(orgName)}</h1><img src="${qr}"><div class="code">${esc(f.code)}</div>
  <p><b>${esc(f.head_name)}</b></p><p>${esc(f.neighborhood)}</p><p style="color:#666;font-size:11px">تُبرز هذه البطاقة عند استلام المساعدة</p></div>
  <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}
