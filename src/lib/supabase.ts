import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ghaith-auth' },
});

export const phoneToEmail = (phone: string) => `${phone}@alrahma.local`;

export type Role = 'owner' | 'admin' | 'accountant' | 'researcher' | 'warehouse' | 'distributor' | 'auditor';

export interface Profile { id: string; full_name: string; phone: string; role: Role; active: boolean; org_id: string | null; created_at: string }
export interface Org {
  id: string; name: string; tagline: string | null; governorate: string | null; contact_phone: string | null;
  status: 'active' | 'suspended'; plan: 'trial' | 'basic' | 'pro'; subscription_ends: string | null; approval_threshold: number; created_at: string;
}

export interface Family {
  id: string; code: string; head_name: string; phone: string; national_id: string | null;
  governorate: string; district: string; neighborhood: string; landmark: string;
  lat: number | null; lng: number | null; categories: string[];
  members: number; children: number; orphans: number; elderly: number; disabled: number; chronic: number;
  breadwinner: string; monthly_income: number; income_source: string | null; housing: string; rent: number; debts: number;
  other_aid: boolean; researcher_bonus: number; researcher_note: string | null; notes: string | null;
  score: number; tier: 'A' | 'B' | 'C'; status: 'pending_visit' | 'active' | 'inactive';
  reported_by_name: string | null; reported_by_phone: string | null; created_at: string; assessed_at: string | null;
}

export interface Fund { id: string; name: string; kind: string; income: number; spent: number; balance: number }
export interface Donation {
  id: string; receipt_no: number; donor_name: string; donor_phone: string | null; amount: number; currency: string; rate: number;
  amount_iqd: number; method: string; fund_id: string; purpose: string; txn_ref: string | null; notes: string | null; created_at: string;
}
export interface Expense {
  id: string; amount_iqd: number; kind: string; description: string; fund_id: string; purpose: string; vendor: string | null;
  invoice_path: string | null; family_id: string | null; campaign_id: string | null; status: 'pending' | 'approved' | 'rejected';
  created_by: string | null; created_at: string;
}
export interface Item { id: string; name: string; unit: string; qty: number; min_qty: number }
export interface Campaign {
  id: string; name: string; kind: string; description: string | null; basket: { item_id: string; qty: number }[];
  cash_per_family: number; status: 'active' | 'done'; starts_on: string; ends_on: string | null; created_at: string;
}
export interface Distribution {
  id: string; campaign_id: string; family_id: string; distributor_id: string | null;
  status: 'scheduled' | 'delivered' | 'not_delivered'; reason: string | null; delivered_at: string | null;
}

/** Turns a Postgres / network error into one plain Arabic sentence. */
export function errText(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? '');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'ماكو اتصال بالإنترنت، حاول مرة ثانية';
  if (/row-level security|permission denied/i.test(m)) return 'ما عندك صلاحية لهذا الإجراء';
  if (/duplicate key/i.test(m)) return 'هذا السجل موجود من قبل';
  if (/[؀-ۿ]/.test(m)) return m.replace(/^.*?ERROR:\s*/i, '');
  return 'صار خطأ، حاول مرة ثانية';
}
