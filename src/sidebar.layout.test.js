import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Sidebar bottom anchor and release metadata', () => {
  it('pins the recycle bin entry and version label to the sidebar bottom', () => {
    const source = readFileSync(new URL('./components/AppSidebar.jsx', import.meta.url), 'utf8');

    expect(source).toContain('className="p-6 h-full flex flex-col"');
    expect(source).toContain('className="space-y-1 overflow-y-auto flex-1 min-h-0 custom-scrollbar"');
    expect(source).toContain('className="mt-auto pt-6"');
  });

  it('records the latest sidebar anchor release update in version metadata', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

    expect(source).toContain("{ level: 'minor', label: 'chat-zero-retention-and-recycle-bin-hardening' }");
    expect(source).toContain("{ level: 'patch', label: 'shared-supabase-config' }");
    expect(source).toContain("{ level: 'patch', label: 'app-shell-refactor' }");
    expect(source).toContain("{ level: 'patch', label: 'sidebar-bottom-anchor-fix' }");
  });
});
