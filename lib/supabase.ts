import { createClient } from '@supabase/supabase-js';
// Public project identifiers only. Row-level security and database functions enforce access.
// The prod-challenge branch talks to the PROD CHALLENGE project, never to the live app's project.
export const supabase = createClient(
  'https://pngcjrgealbqocfrlozw.supabase.co',
  'sb_publishable_5QqUbfjy6x1UJbdGe2BNmQ_fm8nz7KE',
);
/** Calls a database function; throws its error message on failure. Use the typed wrappers in lib/api.ts. */
export async function action(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}
