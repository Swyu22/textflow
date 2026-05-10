import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Post ADR-0005: backend is split across multiple .ts files. Read them all
// and concat so source-level contract assertions don't break on every refactor.
//
// IMPORTANT: 后端/ lives in the root repo, *outside* textflow-fe. CI runners
// only check out textflow-fe, so the directory will be absent there. We
// gracefully skip the assertions when the directory is missing.
const flowApiDir = fileURLToPath(new URL('../../../后端/supabase/functions/flow-api/', import.meta.url));

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

describeIfBackend('flow-api admin password handling (local only — needs 后端/)', () => {
  it('does not hardcode a fallback admin password in source', () => {
    expect(backendSource).not.toContain('DEFAULT_CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('后台密码未配置');
  });
});
