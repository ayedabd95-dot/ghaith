import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from './supabase';

/** Family reports saved on the device while there is no connection, sent when it comes back. */
const KEY = 'alrahma-offline-families';
type Draft = Record<string, unknown> & { _local_id: string; _saved_at: string };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let cache: Draft[] = read();

function read(): Draft[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(list: Draft[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  emit();
}

export function queueFamily(row: Record<string, unknown>) {
  write([...cache, { ...row, _local_id: crypto.randomUUID(), _saved_at: new Date().toISOString() }]);
}

export function useOfflineQueue() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => cache);
}

let syncing = false;
export async function syncQueue(): Promise<number> {
  if (syncing || !navigator.onLine || !cache.length) return 0;
  syncing = true;
  let sent = 0;
  try {
    for (const d of [...cache]) {
      const { _local_id, _saved_at, ...row } = d;
      void _saved_at;
      const { error } = await supabase.from('ch_families').insert(row);
      if (error && /fetch|network/i.test(error.message)) break;
      write(cache.filter((x) => x._local_id !== _local_id));
      if (!error) sent++;
    }
  } finally { syncing = false; }
  return sent;
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => { setOn(true); syncQueue(); };
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

export const isNetworkError = (e: unknown) => /fetch|network/i.test((e as { message?: string })?.message ?? '');
