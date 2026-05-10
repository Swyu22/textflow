import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Post ADR-0005: backend is split across multiple .ts files. Read them all
// and concat so source-level contract assertions don't break on every refactor.
const flowApiDir = fileURLToPath(new URL('../../后端/supabase/functions/flow-api/', import.meta.url));
const backendSource = readdirSync(flowApiDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => readFileSync(join(flowApiDir, name), 'utf8'))
  .join('\n\n');

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
