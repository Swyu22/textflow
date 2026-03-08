import { describe, expect, it } from 'vitest';
import {
  buildAdminPasswordHeaders,
  createTrashAccessState,
  getVisibleNotes,
  isTrashedNote,
  removeNoteById,
  sortTrashedNotes,
  upsertNoteAtTop,
  TRASH_BUTTON_REVEAL_DELAY_MS,
} from './trash';

describe('trash helpers', () => {
  it('uses a 5 second desktop reveal delay for the trash entry', () => {
    expect(TRASH_BUTTON_REVEAL_DELAY_MS).toBe(5000);
  });

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

  it('preserves existing headers while adding the admin password header', () => {
    const headers = buildAdminPasswordHeaders('5185', { 'Content-Type': 'application/json' });
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('x-admin-password')).toBe('5185');
  });

  it('sorts trashed notes from newest deletion to oldest', () => {
    const notes = [
      { id: 'old', deleted_at: '2026-03-07T00:00:00.000Z' },
      { id: 'new', deleted_at: '2026-03-08T00:00:00.000Z' },
      { id: 'missing' },
    ];

    expect(sortTrashedNotes(notes).map((note) => note.id)).toEqual(['new', 'old', 'missing']);
  });

  it('removes a note by id from any collection', () => {
    const notes = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(removeNoteById(notes, '2').map((note) => note.id)).toEqual(['1', '3']);
  });

  it('upserts a note to the top of the collection without duplicating ids', () => {
    const notes = [{ id: '1', title: 'old-1' }, { id: '2', title: 'old-2' }];
    const restored = { id: '2', title: 'restored-2' };

    expect(upsertNoteAtTop(notes, restored)).toEqual([
      { id: '2', title: 'restored-2' },
      { id: '1', title: 'old-1' },
    ]);
  });
});
