import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationSource = readFileSync(
  new URL('../../supabase/migrations/20260308223000_chat_zero_retention.sql', import.meta.url),
  'utf8',
);

describe('chat zero-retention migration', () => {
  it('introduces explicit room destruction and short-lived rate-limit cleanup', () => {
    expect(migrationSource).toContain('create or replace function public.destroy_room');
    expect(migrationSource).toContain('delete from public.chat_events');
    expect(migrationSource).toContain("attempted_at < now() - interval '2 minutes'");
  });

  it('turns chat event logging into a no-op to avoid persistent room traces', () => {
    expect(migrationSource).toContain('returns void');
    expect(migrationSource).toContain('-- no-op by design');
  });
});
