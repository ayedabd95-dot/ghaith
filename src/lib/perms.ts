import type { Profile } from './supabase';

/** Permissions an admin can hand to a volunteer, one by one. */
export const PERMS = [
  { key: 'families_add', label: 'تسجيل العوائل وزيارتها', hint: 'يضيف بلاغات ويعبي استمارة التقييم' },
  { key: 'families_view', label: 'مشاهدة العوائل والخريطة', hint: 'يشوف قائمة العوائل وملفاتها وموقعها' },
  { key: 'distribute', label: 'التوزيع', hint: 'ينضاف كموزّع بالحملات ويأكد التسليم بمساره' },
  { key: 'campaigns_view', label: 'مشاهدة الحملات', hint: 'يشوف الحملات ونسب التوزيع' },
  { key: 'inventory_view', label: 'مشاهدة المخزن', hint: 'يشوف المواد والكميات' },
] as const;
export type Perm = (typeof PERMS)[number]['key'];

/** True when the member may use a feature: full roles by role, volunteers by their ticked permissions. */
export function allowed(p: Profile | null, roles: string[], perms: Perm[] = []) {
  if (!p) return false;
  if (roles.includes(p.role)) return true;
  return p.role === 'volunteer' && perms.some((x) => (p.perms ?? []).includes(x));
}
