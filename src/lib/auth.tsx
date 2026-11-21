import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, phoneToEmail, type Profile, type Role } from './supabase';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  idleWarning: boolean;
  signIn: (phone: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  stayActive: () => void;
  can: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

/** Office roles are signed out after 30 idle minutes; field roles stay signed in for 7 days. */
const IDLE_MS: Record<Role, number> = {
  admin: 30 * 60_000, accountant: 30 * 60_000, auditor: 30 * 60_000,
  researcher: 7 * 86_400_000, distributor: 7 * 86_400_000, warehouse: 7 * 86_400_000,
};
const LAST_KEY = 'alrahma-last-active';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [idleWarning, setIdleWarning] = useState(false);
  const profileRef = useRef<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); profileRef.current = null; return; }
    const { data } = await supabase.from('ch_profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (!data || !data.active) {
      await supabase.auth.signOut();
      setSession(null); setProfile(null); profileRef.current = null;
      return;
    }
    setProfile(data as Profile); profileRef.current = data as Profile;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s) {
        const last = Number(localStorage.getItem(LAST_KEY) || 0);
        const { data: p } = await supabase.from('ch_profiles').select('role').eq('id', s.user.id).maybeSingle();
        const limit = p ? IDLE_MS[p.role as Role] : 0;
        if (last && Date.now() - last > limit) { await supabase.auth.signOut(); setLoading(false); return; }
      }
      setSession(s);
      await loadProfile(s);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_OUT') { setProfile(null); profileRef.current = null; }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const stayActive = useCallback(() => { localStorage.setItem(LAST_KEY, String(Date.now())); setIdleWarning(false); }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(LAST_KEY);
    setSession(null); setProfile(null); profileRef.current = null;
  }, []);

  // Idle tracking
  useEffect(() => {
    if (!profile) return;
    const bump = () => { if (!idleWarning) localStorage.setItem(LAST_KEY, String(Date.now())); };
    bump();
    const evs = ['pointerdown', 'keydown', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const limit = IDLE_MS[profile.role];
      const idle = Date.now() - Number(localStorage.getItem(LAST_KEY) || Date.now());
      if (idle > limit) signOut();
      else if (limit <= 60 * 60_000 && idle > limit - 60_000) setIdleWarning(true);
    }, 15_000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(t); };
  }, [profile, idleWarning, signOut]);

  const signIn = useCallback(async (phone: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
    if (error) {
      if (/invalid/i.test(error.message)) return 'رقم الهاتف أو كلمة السر غلط';
      if (/banned/i.test(error.message)) return 'هذا الحساب موقوف، راجع مدير النظام';
      if (/rate|too many/i.test(error.message)) return 'محاولات كثيرة، انتظر شوية وحاول مرة ثانية';
      return 'ماكو اتصال بالإنترنت، حاول مرة ثانية';
    }
    localStorage.setItem(LAST_KEY, String(Date.now()));
    setSession(data.session);
    await loadProfile(data.session);
    if (!profileRef.current) return 'هذا الحساب مو مسجل بفريق المؤسسة';
    return null;
  }, [loadProfile]);

  const can = useCallback((...roles: Role[]) => !!profile && roles.includes(profile.role), [profile]);

  return (
    <Ctx.Provider value={{ session, profile, loading, idleWarning, signIn, signOut, stayActive, can }}>
      {children}
    </Ctx.Provider>
  );
}
