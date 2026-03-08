import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('FlowChat tab label', () => {
  it('uses readable Chinese text for the room chat tab', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    expect(source).toContain('流式聊天');
    expect(source).not.toContain('>FlowChat</button>');
  });
});
