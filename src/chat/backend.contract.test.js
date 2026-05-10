import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Post ADR-0005: backend is split across multiple .ts files. Read them all
// and concat so source-level contract assertions don't break on every refactor.
const flowApiDir = fileURLToPath(new URL('../../../后端/supabase/functions/flow-api/', import.meta.url));
const backendSource = readdirSync(flowApiDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => readFileSync(join(flowApiDir, name), 'utf8'))
  .join('\n\n');

describe('flow-api admin password handling', () => {
  it('does not hardcode a fallback admin password in source', () => {
    expect(backendSource).not.toContain('DEFAULT_CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('后台密码未配置');
  });
});
