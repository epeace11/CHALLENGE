import { createClient } from '@supabase/supabase-js';
// Public project identifiers only. Row-level security and database functions enforce access.
export const supabase = createClient(
  'https://llctyiwwcytwmemmnrvw.supabase.co',
  'sb_publishable_HcWIDbVNyUa1MX7_UKPTTg_rhwQaRqp',
);
let offline = false;
export const OFFLINE = 'Demo mode: nothing is saved.';
/** Demo mode (hooks/use-demo.ts): from now on every database function call fails instead of being sent. */
export const goOffline = () => {
  offline = true;
};
export const isOffline = () => offline;

/** Calls a database function; throws its error message on failure. Use the typed wrappers in lib/api.ts. */
export async function action(name: string, args: Record<string, unknown> = {}) {
  if (offline) throw new Error(OFFLINE);
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
