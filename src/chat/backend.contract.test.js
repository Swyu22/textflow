import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const backendSource = readFileSync(
  new URL('../../../后端/supabase/functions/flow-api/index.ts', import.meta.url),
  'utf8',
);

describe('flow-api admin password handling', () => {
  it('does not hardcode a fallback admin password in source', () => {
    expect(backendSource).not.toContain('DEFAULT_CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('CATEGORY_DELETE_PASSWORD');
    expect(backendSource).toContain('后台密码未配置');
  });
});
