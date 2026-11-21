import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { logoUrl, uploadLogo, removeLogo } from '../lib/logo';

/** Shows an org's logo with buttons to replace or remove it. */
export default function LogoPicker({ orgId, path, onChange }: { orgId: string; path: string | null; onChange: (p: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(''); setBusy(true);
    try { onChange(await uploadLogo(orgId, f, path)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const clear = async () => {
    if (!path) return;
    setBusy(true);
    try { await removeLogo(orgId, path); onChange(null); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      <span className="field-label">شعار المؤسسة</span>
      <div className="flex items-center gap-4">
        <img src={logoUrl(path)} alt="شعار المؤسسة" className="size-20 rounded-2xl object-contain bg-ink-50 border border-ink-200 p-1" />
        <div className="flex flex-col gap-2">
          <label className={`btn-ghost btn-sm cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            <ImagePlus className="size-4" />{busy ? 'جاري الرفع…' : path ? 'تغيير الشعار' : 'رفع شعار'}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {path && <button type="button" className="btn-ghost btn-sm text-red-700" disabled={busy} onClick={clear}><Trash2 className="size-4" />حذف الشعار</button>}
        </div>
      </div>
      <p className="text-xs text-ink-500 mt-2">صورة مربعة PNG أو JPG، أقل من 2 ميغا. تطلع بالقائمة والوصولات وبطاقات العوائل.</p>
      {err && <p className="text-sm text-red-600 mt-1" role="alert">{err}</p>}
    </div>
  );
}
