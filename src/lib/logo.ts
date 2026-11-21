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

export const assetUrl = (bucket: 'ch-logos' | 'ch-ids', path: string | null | undefined) =>
  path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

/** Uploads a signature or stamp image for the org and stores its path. */
export async function uploadOrgImage(orgId: string, kind: 'sign' | 'stamp', file: File, oldPath: string | null): Promise<string> {
  const ext = TYPES[file.type];
  if (!ext) throw new Error('الصورة لازم تكون PNG أو JPG أو WEBP');
  if (file.size > 2_000_000) throw new Error('حجم الصورة أكبر من 2 ميغا');
  const path = `${orgId}/${kind}-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from('ch-logos').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error('تعذر رفع الصورة');
  const col = kind === 'sign' ? 'signature_path' : 'stamp_path';
  const { error } = await supabase.from('ch_orgs').update({ [col]: path }).eq('id', orgId);
  if (error) { await supabase.storage.from('ch-logos').remove([path]); throw new Error('تعذر حفظ الصورة'); }
  if (oldPath) await supabase.storage.from('ch-logos').remove([oldPath]);
  return path;
}

/** Crops a photo to a 3:4 portrait, re-encodes it as JPEG (drops EXIF/location), uploads it for the member. */
export async function uploadMemberPhoto(orgId: string, memberId: string, file: File, oldPath: string | null): Promise<string> {
  if (!TYPES[file.type]) throw new Error('الصورة لازم تكون PNG أو JPG أو WEBP');
  const bmp = await createImageBitmap(file);
  const W = 600, H = 800, ratio = W / H;
  let sw = bmp.width, sh = bmp.height;
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
  const sx = (bmp.width - sw) / 2, sy = Math.max(0, (bmp.height - sh) / 2.6);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, W, H);
  const blob: Blob = await new Promise((r, j) => c.toBlob((b) => (b ? r(b) : j(new Error('تعذر تجهيز الصورة'))), 'image/jpeg', 0.88));
  const path = `${orgId}/photo-${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from('ch-ids').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error('تعذر رفع الصورة');
  const { error } = await supabase.from('ch_profiles').update({ photo_path: path }).eq('id', memberId);
  if (error) { await supabase.storage.from('ch-ids').remove([path]); throw new Error('تعذر حفظ الصورة'); }
  if (oldPath) await supabase.storage.from('ch-ids').remove([oldPath]);
  return path;
}
