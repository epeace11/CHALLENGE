import { createClient } from '@supabase/supabase-js';
// Public project identifiers only. Row-level security and database functions enforce access.
export const supabase=createClient('https://llctyiwwcytwmemmnrvw.supabase.co','sb_publishable_HcWIDbVNyUa1MX7_UKPTTg_rhwQaRqp');
export async function action(name:string,args:Record<string,unknown>={}){const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);return data}
