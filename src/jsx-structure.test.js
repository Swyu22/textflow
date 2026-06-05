import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcDir = fileURLToPath(new URL('./', import.meta.url));

const collectJsxFiles = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return collectJsxFiles(path);
  return entry.isFile() && entry.name.endsWith('.jsx') ? [path] : [];
});

describe('JSX structure contracts', () => {
  it('does not duplicate the type attribute on button elements', () => {
    const offenders = collectJsxFiles(srcDir).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/<button\b[^>]*>/gms))
        .filter((match) => (match[0].match(/\btype=/g) || []).length > 1)
        .map((match) => `${file}:${source.slice(0, match.index).split('\n').length}`);
    });

    expect(offenders).toEqual([]);
  });
});
