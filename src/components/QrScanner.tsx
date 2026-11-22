import { useEffect, useRef, useState } from 'react';

/** Camera scanner for QR codes and card barcodes. Calls onCode once per mount. */
export default function Scanner({ onCode }: { onCode: (c: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef(`qr-${Math.random().toString(36).slice(2)}`);
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
    <div id={idRef.current} ref={ref} className="rounded-xl overflow-hidden bg-ink-900 min-h-[240px]" />
    <p className="text-sm text-ink-500 mt-2 text-center">{msg}</p>
  </>);
}
