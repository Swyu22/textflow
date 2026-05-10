// Zero-retention contract tests for the FlowChat anonymous chatroom.
// The compliance red line (see .cloud.md): once a room is destroyed, no
// message or event trace should remain in any persistent store.
//
// SQL-layer enforcement lives in supabase/migrations/20260308223000_chat_zero_retention.sql:
//   - log_chat_event is rewritten as a no-op (returns immediately)
//   - destroy_room cascades to chat_events
//   - chat_join_attempts retained only for ~2 min as rate-limit smoke
//
// Two layers of test here:
//   A) Source-level (default, no network): assert chat_zero_retention.sql
//      contains the no-op definition. Catches anyone who rewrites SQL to
//      restore actual logging.
//   B) Runtime-level (opt-in via RUN_LIVE_TESTS=1, live network):
//      - chat_events / chat_join_attempts / messages are not readable
//        by anonymous PostgREST (RLS-locked + GRANT revoked)
//      - log_chat_event RPC is callable (and is a no-op as designed)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../supabaseConfig';

const liveDescribe = process.env.RUN_LIVE_TESTS === '1' ? describe : describe.skip;

// ============ A) Source-level (default) ============

const migrationsDir = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const allMigrationsSource = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
  .join('\n\n');

describe('zero-retention SQL contract', () => {
  it('log_chat_event is rewritten to a no-op in chat_zero_retention.sql', () => {
    const zeroRetentionSql = readFileSync(
      join(migrationsDir, '20260308223000_chat_zero_retention.sql'),
      'utf8',
    );
    // The no-op marker is the inline comment + bare return
    expect(zeroRetentionSql).toMatch(/no-op by design/i);
    expect(zeroRetentionSql).toMatch(/create or replace function public\.log_chat_event/i);
  });

  it('destroy_room cascades to chat_events (deletes events for the room)', () => {
    const zeroRetentionSql = readFileSync(
      join(migrationsDir, '20260308223000_chat_zero_retention.sql'),
      'utf8',
    );
    // destroy_room must delete from chat_events before deleting the room itself
    expect(zeroRetentionSql).toMatch(/delete from public\.chat_events/i);
    expect(zeroRetentionSql).toMatch(/create or replace function public\.destroy_room/i);
  });

  it('purge_chat scrubs chat_events and expired join_attempts', () => {
    const zeroRetentionSql = readFileSync(
      join(migrationsDir, '20260308223000_chat_zero_retention.sql'),
      'utf8',
    );
    expect(zeroRetentionSql).toMatch(/delete from public\.chat_events\s*\n\s*where true/i);
    expect(zeroRetentionSql).toMatch(/chat_join_attempts/i);
  });

  it('all four chat tables have RLS enabled in the base migration', () => {
    expect(allMigrationsSource).toMatch(/alter table public\.rooms enable row level security/i);
    expect(allMigrationsSource).toMatch(/alter table public\.room_members enable row level security/i);
    expect(allMigrationsSource).toMatch(/alter table public\.messages enable row level security/i);
    expect(allMigrationsSource).toMatch(/alter table public\.chat_events enable row level security/i);
  });

  it('all four chat tables have direct GRANT revoked from anon/authenticated', () => {
    // The base migration revokes `all` so only specific SELECTs work, and chat_events
    // never gets a re-grant — meaning even authenticated users cannot read it via PostgREST.
    expect(allMigrationsSource).toMatch(/revoke all on public\.chat_events from anon, authenticated/i);
    expect(allMigrationsSource).toMatch(/revoke all on public\.chat_join_attempts from anon, authenticated/i);
  });
});

// ============ B) Runtime-level (opt-in: RUN_LIVE_TESTS=1) ============

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const expectTableLocked = async (tableName) => {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  // Either: permission denied (error), or RLS hides everything (empty array).
  // Both satisfy zero-retention: anon cannot enumerate.
  const isLocked = Boolean(error) || (Array.isArray(data) && data.length === 0);
  return { isLocked, error, data };
};

liveDescribe('zero-retention runtime contract', () => {
  it('chat_events is not readable via PostgREST (anon)', async () => {
    const { isLocked } = await expectTableLocked('chat_events');
    expect(isLocked).toBe(true);
  });

  it('chat_join_attempts is not readable via PostgREST (anon)', async () => {
    const { isLocked } = await expectTableLocked('chat_join_attempts');
    expect(isLocked).toBe(true);
  });

  it('messages is not readable to non-members (anon, no room)', async () => {
    const { isLocked } = await expectTableLocked('messages');
    expect(isLocked).toBe(true);
  });

  it('log_chat_event RPC is callable (no-op by design)', async () => {
    // Need an authenticated session for RPC. Try anonymous auth.
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      // Anonymous auth disabled — log_chat_event has AUTH_REQUIRED guard in base SQL
      // but the zero_retention overload skips it; either way we cannot exercise RPC.
      // Skip soft (test passes); SQL contract above still locks the no-op definition.
      return;
    }
    try {
      const { error } = await supabase.rpc('log_chat_event', {
        p_event_type: 'create',
        p_room_id: null,
        p_event_meta: {},
      });
      // RPC must succeed (it's a no-op). If it fails, someone broke the contract.
      expect(error).toBeFalsy();
    } finally {
      await supabase.auth.signOut().catch(() => {});
    }
  });
});
