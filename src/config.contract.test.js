import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Supabase frontend config', () => {
  it('centralizes public Supabase config in one module', () => {
    const configUrl = new URL('./supabaseConfig.js', import.meta.url);
    const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const chatClientSource = readFileSync(new URL('./chat/supabaseClient.js', import.meta.url), 'utf8');

    expect(existsSync(configUrl)).toBe(true);
    expect(appSource).toContain("from './supabaseConfig'");
    expect(chatClientSource).toContain("from '../supabaseConfig'");
    expect(appSource).not.toContain('sb_publishable_Ci3qp9_9ZLBcbWodKeS19A_X39ZTrUk');
    expect(chatClientSource).not.toContain('sb_publishable_Ci3qp9_9ZLBcbWodKeS19A_X39ZTrUk');

    const configSource = readFileSync(configUrl, 'utf8');
    expect(configSource).toContain('export const SUPABASE_FUNC_URL');
    expect(configSource).toContain('export const SUPABASE_PUBLISHABLE_KEY');
    expect(configSource).toContain('export const SUPABASE_URL');
    expect(configSource).toContain('export const SUPABASE_ANON_KEY');
  });
});
