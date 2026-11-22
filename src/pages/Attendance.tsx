import { useEffect, useMemo, useState } from 'react';
import { Clock3, LogIn, LogOut, ScanLine, Download, Users } from 'lucide-react';
import { supabase, errText, type Profile } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, dateShort, num, toCSV, dateAr } from '../lib/format';
import { useLoad, PageHeader, ListSkeleton, ErrorBox, Section, Modal, useToast } from '../components/ui';
import Scanner from '../components/QrScanner';

interface Row { id: string; profile_id: string; check_in: string; check_out: string | null; method: string }

const hm = (mins: number) => { const h = Math.floor(mins / 60), m = Math.round(mins % 60); return h ? `${num(h)} س ${m ? `${m} د` : ''}` : `${m} د`; };
const time = (t: string) => new Date(t).toLocaleTimeString('ar-IQ-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
const minutesOf = (r: Row, now = Date.now()) => ((r.check_out ? new Date(r.check_out).getTime() : now) - new Date(r.check_in).getTime()) / 60000;
const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

export default function Attendance() {
  const { profile, can } = useAuth();
  const toast = useToast();
  const manager = can('admin', 'auditor');
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);

  const { data, loading, error, reload } = useLoad(async () => {
    const [a, p] = await Promise.all([
      (() => {
        const q = supabase.from('ch_attendance').select('id,profile_id,check_in,check_out,method').gte('check_in', monthStart().toISOString());
        return (manager ? q : q.eq('profile_id', profile!.id)).order('check_in', { ascending: false }).limit(2000);
      })(),
      manager ? supabase.from('ch_profiles').select(can('admin') ? 'id,full_name,role,card_token,active' : 'id,full_name,role,active').eq('active', true).order('full_name') : Promise.resolve({ data: [] }),
    ]);
    if (a.error) throw a.error;
    return { rows: (a.data ?? []) as Row[], people: (p.data ?? []) as unknown as Pick<Profile, 'id' | 'full_name' | 'role' | 'card_token'>[] };
  }, [manager]);

  const mine = useMemo(() => (data?.rows ?? []).filter((r) => r.profile_id === profile!.id), [data, profile]);
  const open = mine.find((r) => !r.check_out);
  const myMonth = mine.reduce((s, r) => s + minutesOf(r), 0);
  const myDays = new Set(mine.map((r) => r.check_in.slice(0, 10))).size;

  const toggleSelf = async () => {
    setBusy(true);
    const { data: res, error } = await supabase.rpc('ch_attendance_toggle');
    setBusy(false);
    if (error) { toast({ kind: 'err', text: errText(error) }); return; }
    toast({ kind: 'ok', text: res.state === 'in' ? 'انسجل حضورك. يعطيك العافية' : `انسجل انصرافك — اشتغلت ${hm(res.minutes)}` });
    reload();
  };
  const scanCode = async (code: string) => {
    const { data: res, error } = await supabase.rpc('ch_attendance_scan', { code });
    setScanKey((k) => k + 1);
    if (error) { setLast(`✗ ${errText(error)}`); return; }
    setLast(res.state === 'in' ? `✓ حضور: ${res.name}` : `✓ انصراف: ${res.name} (${hm(res.minutes)})`);
    reload();
  };
  const toggleOther = async (token: string) => { setBusy(true); await scanCode(token); setBusy(false); };

  if (error) return <ErrorBox text="تعذر تحميل الحضور" retry={reload} />;
  if (loading || !data) return <ListSkeleton rows={6} />;

  const name = (id: string) => data.people.find((p) => p.id === id)?.full_name ?? '—';
  const presentNow = data.rows.filter((r) => !r.check_out);
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = data.rows.filter((r) => r.check_in.slice(0, 10) === today);
  const perPerson = data.people.map((p) => {
    const rs = data.rows.filter((r) => r.profile_id === p.id);
    return { p, mins: rs.reduce((s, r) => s + minutesOf(r), 0), days: new Set(rs.map((r) => r.check_in.slice(0, 10))).size, open: rs.some((r) => !r.check_out) };
  }).sort((a, b) => b.mins - a.mins);

  return (
    <div className="space-y-4">
      <PageHeader title="الحضور والانصراف" sub={`شهر ${new Date().toLocaleDateString('ar-IQ-u-nu-latn', { month: 'long', year: 'numeric' })}`} icon={Clock3}
        actions={can('admin') && <button className="btn-primary" onClick={() => { setLast(null); setScan(true); }}><ScanLine className="size-5" />امسح بطاقة عضو</button>} />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className={`card p-6 lg:col-span-2 text-center ${open ? 'bg-brand-50 border-brand-100' : ''}`}>
          <div className="text-ink-500">{open ? <>أنت حاضر من الساعة <b className="text-ink-900">{time(open.check_in)}</b> · صار لك <b className="text-ink-900">{hm(minutesOf(open))}</b></> : 'أنت مسجّل خروج هسه'}</div>
          <button disabled={busy} onClick={toggleSelf}
            className={`btn mx-auto mt-5 h-20 w-full max-w-sm rounded-2xl text-xl text-white shadow-lift ${open ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-700 hover:bg-brand-800'}`}>
            {open ? <><LogOut className="size-7" />تسجيل انصراف</> : <><LogIn className="size-7" />تسجيل حضور</>}
          </button>
          <p className="text-xs text-ink-500 mt-3">ضغطة وحدة عند الوصول، وضغطة عند المغادرة.</p>
        </div>
        <div className="card p-5 grid grid-cols-2 gap-3 content-center">
          <div className="rounded-xl bg-ink-50 p-4 text-center"><div className="text-2xl font-bold">{hm(myMonth)}</div><div className="text-xs text-ink-500 mt-1">ساعاتي هذا الشهر</div></div>
          <div className="rounded-xl bg-ink-50 p-4 text-center"><div className="text-2xl font-bold num">{num(myDays)}</div><div className="text-xs text-ink-500 mt-1">يوم حضور</div></div>
        </div>
      </div>

      {!manager && (
        <Section title="سجلي">
          {!mine.length ? <p className="text-ink-500 text-sm py-4 text-center">ما سجلت حضور هذا الشهر بعد.</p> : (
            <ul className="divide-y divide-ink-100">{mine.slice(0, 30).map((r) => (
              <li key={r.id} className="flex justify-between py-2.5 text-[15px]"><span>{dateShort(r.check_in)}</span><span className="num">{time(r.check_in)} ← {r.check_out ? time(r.check_out) : 'لحد هسه'}</span><b>{hm(minutesOf(r))}</b></li>
            ))}</ul>
          )}
        </Section>
      )}

      {manager && (<>
        <div className="grid lg:grid-cols-2 gap-4">
          <Section title={`موجودون هسه (${presentNow.length})`} icon={Users}>
            {!presentNow.length ? <p className="text-ink-500 text-sm py-4 text-center">ماكو أحد مسجّل حضور هسه.</p> : (
              <ul className="divide-y divide-ink-100">{presentNow.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5 text-[15px]">
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-brand-600" />{name(r.profile_id)}</span>
                  <span className="text-ink-500">من {time(r.check_in)} · {hm(minutesOf(r))}</span>
                </li>
              ))}</ul>
            )}
          </Section>
          <Section title={`حركة اليوم (${todayRows.length})`} icon={Clock3}>
            {!todayRows.length ? <p className="text-ink-500 text-sm py-4 text-center">ماكو حركة اليوم.</p> : (
              <ul className="divide-y divide-ink-100 max-h-72 overflow-auto">{todayRows.map((r) => (
                <li key={r.id} className="flex justify-between py-2.5 text-[15px]"><span>{name(r.profile_id)}</span><span className="num text-ink-700">{time(r.check_in)} ← {r.check_out ? time(r.check_out) : '…'}</span></li>
              ))}</ul>
            )}
          </Section>
        </div>

        <Section title="ساعات الفريق هذا الشهر" action={
          <button className="btn-ghost btn-sm" onClick={() => toCSV(data.rows.map((r) => ({ الاسم: name(r.profile_id), التاريخ: dateAr(r.check_in), الحضور: time(r.check_in), الانصراف: r.check_out ? time(r.check_out) : '', 'المدة بالدقائق': Math.round(minutesOf(r)), الطريقة: r.method === 'scan' ? 'مسح بطاقة' : 'من الهاتف' })), 'الحضور.csv')}>
            <Download className="size-4" />Excel</button>}>
          <ul className="divide-y divide-ink-100">{perPerson.map(({ p, mins, days, open: isIn }) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className={`size-2.5 rounded-full shrink-0 ${isIn ? 'bg-brand-600' : 'bg-ink-300'}`} />
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{p.full_name}</div><div className="text-xs text-ink-500">{ROLE_LABEL[p.role]} · <span className="num">{num(days)}</span> يوم</div></div>
              <b className="shrink-0">{hm(mins)}</b>
              {can('admin') && p.id !== profile!.id && <button className="btn-ghost btn-sm shrink-0" disabled={busy} onClick={() => toggleOther(p.card_token)}>{isIn ? 'انصراف' : 'حضور'}</button>}
            </li>
          ))}</ul>
        </Section>
      </>)}

      <Modal open={scan} onClose={() => setScan(false)} title="امسح بطاقة العضو">
        <Scanner key={scanKey} onCode={scanCode} />
        {last && <div className={`mt-3 rounded-xl px-4 py-3 font-bold text-center ${last.startsWith('✓') ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-red-700'}`} role="status">{last}</div>}
        <p className="text-sm text-ink-500 mt-3 text-center">امسح رمز التحقق أو الباركود بالبطاقة. أول مسح = حضور، والثاني = انصراف. تكدر تمسح بطاقة ورا بطاقة.</p>
      </Modal>
    </div>
  );
}
