import { createClient } from '@supabase/supabase-js';

const DEFAULT_FUNC_URL = 'https://bktkvzvylkqvlucoixay.supabase.co/functions/v1/flow-api';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ci3qp9_9ZLBcbWodKeS19A_X39ZTrUk';

const deriveSupabaseUrl = () => {
  const explicit = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (explicit) return explicit;

  const funcUrl = String(import.meta.env.VITE_SUPABASE_FUNC_URL || DEFAULT_FUNC_URL).trim();
  const match = funcUrl.match(/^(https:\/\/[^/]+\.supabase\.co)/i);
  return match?.[1] || '';
};

const supabaseUrl = deriveSupabaseUrl();
const supabaseAnonKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY ||
  '',
).trim();

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep this visible in console instead of throwing, so non-chat pages still work.
  console.error('Chat module is missing Supabase config: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl || 'https://invalid.supabase.co', supabaseAnonKey || 'invalid-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
