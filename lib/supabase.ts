import { createClient } from '@supabase/supabase-js';
// Public project identifiers only. Row-level security and database functions enforce access.
export const supabase = createClient(
  'https://llctyiwwcytwmemmnrvw.supabase.co',
  'sb_publishable_HcWIDbVNyUa1MX7_UKPTTg_rhwQaRqp',
);
/** Calls a database function; throws its error message on failure. Use the typed wrappers in lib/api.ts. */
export async function action(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
