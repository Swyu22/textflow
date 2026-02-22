import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ChatApp accessibility', () => {
  it('avoids using autoFocus in chat nickname input', () => {
    const source = readFileSync(new URL('./ChatApp.jsx', import.meta.url), 'utf8');
    expect(source).not.toContain('autoFocus');
  });
});
