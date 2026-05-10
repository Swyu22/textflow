// Note: DEFAULT_SUPABASE_PUBLISHABLE_KEY is a Supabase **publishable** key (sb_publishable_*),
// not a secret. It is safe to expose in client bundles because Supabase RLS policies enforce
// access at the row level. The key is intentionally hardcoded as a fallback so the public site
// works without any runtime env injection. To override (e.g. for staging), set
// VITE_SUPABASE_PUBLISHABLE_KEY in the build env.
const DEFAULT_FUNC_URL = 'https://bktkvzvylkqvlucoixay.supabase.co/functions/v1/flow-api';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ci3qp9_9ZLBcbWodKeS19A_X39ZTrUk';

const normalizeFuncUrl = (value) => String(value || DEFAULT_FUNC_URL).trim().replace(/\/$/, '');
const deriveSupabaseUrl = (funcUrl) => {
  const explicit = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (explicit) return explicit;

  const match = String(funcUrl || '').match(/^(https:\/\/[^/]+\.supabase\.co)/i);
  return match?.[1] || '';
};

export const SUPABASE_FUNC_URL = normalizeFuncUrl(import.meta.env.VITE_SUPABASE_FUNC_URL || DEFAULT_FUNC_URL);
export const SUPABASE_PUBLISHABLE_KEY = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY ||
  '',
).trim();
export const SUPABASE_URL = deriveSupabaseUrl(SUPABASE_FUNC_URL);
export const SUPABASE_ANON_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY ||
  '',
).trim();
