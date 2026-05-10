// Contract tests for the Edge Function flow-api.
// Goal: capture the production API surface so post-split refactor cannot regress.
// These tests hit https://textflow.art's backend (real network calls), so they
// only assert *route shape* / *status codes* / *header presence*, never side
// effects (no POST that mutates data).
//
// Triggered manually via: npx vitest run src/api.contract.test.js
// Skipped automatically if VITE_SUPABASE_FUNC_URL points to a local mock.

import { describe, expect, it } from 'vitest';
import { SUPABASE_FUNC_URL } from './supabaseConfig';

const FN = SUPABASE_FUNC_URL;

describe('flow-api contract: CORS', () => {
  it('OPTIONS /notes returns 204 with CORS headers', async () => {
    const r = await fetch(`${FN}/notes`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://textflow.art' },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
    expect(r.headers.get('access-control-allow-methods')).toMatch(/POST/i);
  });

  it('OPTIONS /chat returns 204 with CORS', async () => {
    const r = await fetch(`${FN}/chat`, { method: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  // Whitelist behavior (ADR-0006 candidate, implemented as middleware in _shared.ts).
  // Whitelisted origins are echoed back; all others fall back to textflow.art.
  // Vary: Origin is required so CDNs do not cache the wrong allow-origin.
  it('CORS echoes whitelisted production origin', async () => {
    const r = await fetch(`${FN}/notes`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://textflow.art' },
    });
    expect(r.headers.get('access-control-allow-origin')).toBe('https://textflow.art');
    expect(r.headers.get('vary')).toMatch(/Origin/i);
  });

  it('CORS echoes whitelisted localhost dev origin', async () => {
    const r = await fetch(`${FN}/notes`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(r.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('CORS falls back to textflow.art for non-whitelisted origin', async () => {
    const r = await fetch(`${FN}/notes`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(r.headers.get('access-control-allow-origin')).toBe('https://textflow.art');
  });

  it('CORS never returns "*" wildcard (post ADR-0006)', async () => {
    const r = await fetch(`${FN}/notes`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://anything.test' },
    });
    expect(r.headers.get('access-control-allow-origin')).not.toBe('*');
  });
});

describe('flow-api contract: notes (GET only, no mutation)', () => {
  it('GET /notes returns ok=true with array', async () => {
    const r = await fetch(`${FN}/notes`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(Array.isArray(j.data)).toBe(true);
  });

  // Use a valid 8-char hex shape (matches isShortNoteId regex) so backend takes
  // the short-id branch and returns clean 404, instead of the UUID error path
  // that yields 500 (known issue, see ADR-0005 "Known baseline issues").
  it('GET /notes/00000000 (valid short-id shape, not exists) → 404 JSON', async () => {
    const r = await fetch(`${FN}/notes/00000000`);
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toMatch(/application\/json/);
    const j = await r.json();
    expect(j.ok).toBe(false);
  });

  it('GET /notes/00000000/text (valid short-id shape, not exists) → 404 plain text', async () => {
    const r = await fetch(`${FN}/notes/00000000/text`);
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toMatch(/text\/plain/);
  });

  // Locked-in known issue: invalid UUID-shaped string returns 500 (Postgres
  // "invalid input syntax for type uuid"). This is documented baseline; if a
  // future refactor changes this to 404, this test will catch the divergence
  // and we can update both the test and ADR-0005.
  it('GET /notes/NOT_A_UUID_NOR_HEX → 500 (baseline, known issue)', async () => {
    const r = await fetch(`${FN}/notes/NOT_A_UUID_NOR_HEX`);
    expect(r.status).toBe(500);
  });
});

describe('flow-api contract: categories (GET only)', () => {
  it('GET /categories returns ok=true with array', async () => {
    const r = await fetch(`${FN}/categories`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(Array.isArray(j.data)).toBe(true);
  });
});

describe('flow-api contract: trash (admin-guarded)', () => {
  it('GET /trash/notes without password → 401 / 403 / 503', async () => {
    const r = await fetch(`${FN}/trash/notes`);
    expect([401, 403, 503]).toContain(r.status);
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(typeof j.error).toBe('string');
  });

  it('POST /trash/notes/:id/restore without password → 401 / 403 / 503', async () => {
    const r = await fetch(`${FN}/trash/notes/INVALID00/restore`, { method: 'POST' });
    expect([401, 403, 503]).toContain(r.status);
  });

  it('DELETE /trash/notes/:id without password → 401 / 403 / 503', async () => {
    const r = await fetch(`${FN}/trash/notes/INVALID00`, { method: 'DELETE' });
    expect([401, 403, 503]).toContain(r.status);
  });
});

describe('flow-api contract: chat', () => {
  it('POST /chat without prompt and without messages → 400', async () => {
    const r = await fetch(`${FN}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.ok).toBe(false);
    expect(j.error).toMatch(/prompt/i);
  });
});

describe('flow-api contract: not-found fallback', () => {
  it('GET /no-such-route → 404 with ok=false', async () => {
    const r = await fetch(`${FN}/no-such-route-12345`);
    expect(r.status).toBe(404);
    const j = await r.json();
    expect(j.ok).toBe(false);
  });
});
