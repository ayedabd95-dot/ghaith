import type { Role } from './supabase';

const nf = new Intl.NumberFormat('en-US');
export const num = (n: number | null | undefined) => nf.format(Math.round(Number(n ?? 0)));
export const money = (n: number | null | undefined) => `${num(n)} د.ع`;
export const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)} م`;
  if (a >= 1_000) return `${Math.round(n / 1_000)} ألف`;
  return num(n);
};
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export const dateAr = (d: string | Date) =>
  new Date(d).toLocaleDateString('ar-IQ-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
export const dateShort = (d: string | Date) =>
  new Date(d).toLocaleDateString('ar-IQ-u-nu-latn', { month: 'short', day: 'numeric' });
export const timeAgo = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return `منذ ${Math.floor(s / 60)} د`;
  if (s < 86400) return `منذ ${Math.floor(s / 3600)} س`;
  if (s < 86400 * 30) return `منذ ${Math.floor(s / 86400)} يوم`;
  return dateShort(d);
};
export const monthKey = (d: string | Date) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
export const monthName = (key: string) =>
  new Date(key + '-01').toLocaleDateString('ar-IQ-u-nu-latn', { month: 'long' });

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'مالك المنصة', admin: 'مدير المؤسسة', accountant: 'محاسب', researcher: 'باحث ميداني',
  warehouse: 'مسؤول المخزن', distributor: 'موزّع', auditor: 'مدقق',
};

export const PLAN: Record<string, string> = { trial: 'تجريبي', basic: 'أساسي', pro: 'احترافي' };

export const CATEGORIES: { key: string; label: string }[] = [
  { key: 'needy', label: 'عائلة متعففة' }, { key: 'widow', label: 'أرملة' },
  { key: 'orphans', label: 'يتيم / أيتام' }, { key: 'chronic', label: 'معيل مريض' },
  { key: 'disability', label: 'إعاقة' }, { key: 'housing', label: 'سكن غير لائق' },
  { key: 'debt', label: 'مديونية' }, { key: 'prisoner', label: 'عائلة معتقل' }, { key: 'other', label: 'أخرى' },
];
export const catLabel = (k: string) => CATEGORIES.find((c) => c.key === k)?.label ?? k;

export const TIER: Record<string, { label: string; short: string; cls: string; dot: string; color: string }> = {
  A: { label: 'أولوية عالية', short: 'أ', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200', dot: 'bg-red-500', color: '#dc2626' },
  B: { label: 'متوسطة', short: 'ب', cls: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200', dot: 'bg-amber-400', color: '#f59e0b' },
  C: { label: 'متابعة', short: 'ج', cls: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100', dot: 'bg-brand-600', color: '#1a7746' },
};
export const FAMILY_STATUS: Record<string, string> = { pending_visit: 'بانتظار الزيارة', active: 'نشطة', inactive: 'متوقفة' };

export const BREADWINNER: Record<string, string> = {
  working: 'يعمل', unemployed: 'عاطل', unable: 'عاجز عن العمل', deceased: 'متوفّى', prisoner: 'معتقل / سجين', unknown: 'غير محدد',
};
export const HOUSING: Record<string, string> = { own: 'ملك', rent: 'إيجار', encroach: 'تجاوز', none: 'بدون سكن', unknown: 'غير محدد' };

export const METHOD: Record<string, string> = { cash: 'نقدي', zaincash: 'زين كاش', bank: 'تحويل مصرفي / ماستر', in_kind: 'تبرع عيني' };
export const PURPOSE: Record<string, string> = { general: 'عام', zakat: 'زكاة', sadaqa: 'صدقة', kafala: 'كفالة يتيم', campaign: 'حملة' };
export const EXPENSE_KIND: Record<string, string> = {
  food: 'مواد غذائية', cash_aid: 'مساعدة نقدية', medical: 'علاج وأدوية', device: 'أجهزة لذوي الإعاقة',
  transport: 'نقل', admin: 'مصاريف إدارية', other: 'أخرى',
};
export const EXPENSE_STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: 'معتمد', cls: 'bg-brand-50 text-brand-700' },
  pending: { label: 'بانتظار الموافقة', cls: 'bg-amber-50 text-amber-800' },
  rejected: { label: 'مرفوض', cls: 'bg-red-50 text-red-700' },
};
export const CAMPAIGN_KIND: Record<string, string> = {
  food_basket: 'سلات غذائية', cash: 'مساعدة نقدية', kafala: 'كفالة أيتام', winter: 'حملة شتوية', other: 'أخرى',
};
export const DIST_STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: 'باقية', cls: 'bg-amber-50 text-amber-800' },
  delivered: { label: 'استلمت', cls: 'bg-brand-50 text-brand-700' },
  not_delivered: { label: 'لم تستلم', cls: 'bg-red-50 text-red-700' },
};

export const GOVERNORATES = ['بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'ذي قار', 'الأنبار', 'ديالى', 'صلاح الدين', 'كركوك', 'واسط', 'ميسان', 'الديوانية', 'المثنى', 'السليمانية', 'دهوك', 'حلبجة'];

export function toCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [keys.map(esc).join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
