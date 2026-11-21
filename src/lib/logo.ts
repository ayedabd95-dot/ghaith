import { supabase } from './supabase';

export const DEFAULT_LOGO = `${import.meta.env.BASE_URL}logo.svg`;
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export const logoUrl = (path: string | null | undefined) =>
  path ? supabase.storage.from('ch-logos').getPublicUrl(path).data.publicUrl : DEFAULT_LOGO;

/** Uploads a new logo for the org, saves its path on the org row, removes the old file. */
export async function uploadLogo(orgId: string, file: File, oldPath: string | null): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error('الشعار لازم يكون صورة PNG أو JPG أو WEBP');
  if (file.size > 2_000_000) throw new Error('حجم الشعار أكبر من 2 ميغا');
  const path = `${orgId}/logo-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('ch-logos').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error('تعذر رفع الشعار');
  const { error } = await supabase.from('ch_orgs').update({ logo_path: path }).eq('id', orgId);
  if (error) { await supabase.storage.from('ch-logos').remove([path]); throw new Error('تعذر حفظ الشعار'); }
  if (oldPath) await supabase.storage.from('ch-logos').remove([oldPath]);
  return path;
}

export async function removeLogo(orgId: string, oldPath: string) {
  const { error } = await supabase.from('ch_orgs').update({ logo_path: null }).eq('id', orgId);
  if (error) throw new Error('تعذر حذف الشعار');
  await supabase.storage.from('ch-logos').remove([oldPath]);
}
