import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('FlowChat tab label', () => {
  it('uses 流式聊天 as the room chat tab text', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    expect(source).toContain('流式聊天');
    expect(source).not.toContain('>FlowChat</button>');
  });
});
