import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Post ADR-0005: backend is split across multiple .ts files. Read them all
// and concat so source-level contract assertions don't break on every refactor.
//
// IMPORTANT: 后端/ lives in the root repo, *outside* textflow-fe. CI runners
// only check out textflow-fe, so the directory will be absent there. We
// gracefully skip the backend-source assertions when the directory is missing
// (local dev with the dual-repo layout sees them; CI does not).
const flowApiDir = fileURLToPath(new URL('../../后端/supabase/functions/flow-api/', import.meta.url));

const readBackendSourceSafe = () => {
  try {
    return readdirSync(flowApiDir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(join(flowApiDir, name), 'utf8'))
      .join('\n\n');
  } catch {
    return null;
  }
};

const backendSource = readBackendSourceSafe();
const describeIfBackend = backendSource ? describe : describe.skip;

const migrationSource = readFileSync(
  new URL('../supabase/migrations/20260308232000_optimize_recycle_bin_indexes.sql', import.meta.url),
  'utf8',
);

describeIfBackend('recycle bin backend source contract (local only — needs 后端/)', () => {
  it('keeps deleted notes out of public reads and exposes trash-only routes', () => {
    expect(backendSource).toContain('.is("deleted_at", null)');
    expect(backendSource).toContain('.not("deleted_at", "is", null)');
    expect(backendSource).toContain('/trash/notes');
    expect(backendSource).toContain('.update({ deleted_at: deletedAt })');
  });
});

describe('recycle bin migration contract', () => {
  it('adds partial indexes for active notes and trash notes access patterns', () => {
    expect(migrationSource).toContain('where deleted_at is null');
    expect(migrationSource).toContain('where deleted_at is not null');
    expect(migrationSource).toContain('notes_active_created_at_idx');
    expect(migrationSource).toContain('notes_trash_deleted_at_idx');
  });
});
