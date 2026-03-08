import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backendSource = readFileSync(
  new URL('../../后端/supabase/functions/flow-api/index.ts', import.meta.url),
  'utf8',
);

const migrationSource = readFileSync(
  new URL('../supabase/migrations/20260308232000_optimize_recycle_bin_indexes.sql', import.meta.url),
  'utf8',
);

describe('recycle bin backend contract', () => {
  it('keeps deleted notes out of public reads and exposes trash-only routes', () => {
    expect(backendSource).toContain('.is("deleted_at", null)');
    expect(backendSource).toContain('.not("deleted_at", "is", null)');
    expect(backendSource).toContain('/trash/notes');
    expect(backendSource).toContain('.update({ deleted_at: deletedAt })');
  });

  it('adds partial indexes for active notes and trash notes access patterns', () => {
    expect(migrationSource).toContain('where deleted_at is null');
    expect(migrationSource).toContain('where deleted_at is not null');
    expect(migrationSource).toContain('notes_active_created_at_idx');
    expect(migrationSource).toContain('notes_trash_deleted_at_idx');
  });
});
