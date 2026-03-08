import { describe, expect, it } from 'vitest';
import {
  buildAdminPasswordHeaders,
  createTrashAccessState,
  getVisibleNotes,
  isTrashedNote,
} from './trash';

describe('trash helpers', () => {
  it('treats deleted_at notes as trashed', () => {
    expect(isTrashedNote({ id: '1', deleted_at: '2026-03-08T00:00:00.000Z' })).toBe(true);
    expect(isTrashedNote({ id: '2', deleted_at: null })).toBe(false);
    expect(isTrashedNote({ id: '3' })).toBe(false);
  });

  it('filters trashed notes out of public note collections', () => {
    const notes = [
      { id: '1', title: 'keep', deleted_at: null },
      { id: '2', title: 'trash', deleted_at: '2026-03-08T00:00:00.000Z' },
      { id: '3', title: 'keep-2' },
    ];

    expect(getVisibleNotes(notes).map((note) => note.id)).toEqual(['1', '3']);
  });

  it('creates a fresh locked trash access state', () => {
    expect(createTrashAccessState()).toEqual({
      isOpen: false,
      password: '',
      error: '',
      isSubmitting: false,
      hasAccess: false,
    });
  });

  it('adds the admin password header only when a password is provided', () => {
    const headers = buildAdminPasswordHeaders('5185');
    expect(headers.get('x-admin-password')).toBe('5185');
    expect(buildAdminPasswordHeaders('').has('x-admin-password')).toBe(false);
  });
});
