import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('App structure refactors', () => {
  it('moves recycle bin state into a dedicated hook', () => {
    const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const hookUrl = new URL('./hooks/useTrashManager.js', import.meta.url);

    expect(existsSync(hookUrl)).toBe(true);
    expect(appSource).toContain("import useTrashManager from './hooks/useTrashManager';");
    expect(appSource).not.toContain('const [trashAccessState, setTrashAccessState] = useState');
    expect(appSource).not.toContain('const [trashedNotes, setTrashedNotes] = useState');
    expect(appSource).not.toContain('const [isTrashLoading, setIsTrashLoading] = useState');
    expect(appSource).not.toContain('const [trashPendingNoteId, setTrashPendingNoteId] = useState');

    const hookSource = readFileSync(hookUrl, 'utf8');
    expect(hookSource).toContain('useReducer');
    expect(hookSource).toContain('handleTrashAccessSubmit');
    expect(hookSource).toContain('handleRestoreTrashedNote');
    expect(hookSource).toContain('handlePermanentDeleteTrashedNote');
  });

  it('moves large modal UIs into dedicated components', () => {
    const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const noteModalUrl = new URL('./components/NoteEditorModal.jsx', import.meta.url);
    const categoryDialogUrl = new URL('./components/CategoryDeleteDialog.jsx', import.meta.url);

    expect(existsSync(noteModalUrl)).toBe(true);
    expect(existsSync(categoryDialogUrl)).toBe(true);
    expect(appSource).toContain("import NoteEditorModal from './components/NoteEditorModal';");
    expect(appSource).toContain("import CategoryDeleteDialog from './components/CategoryDeleteDialog';");
    expect(appSource).toContain('<NoteEditorModal');
    expect(appSource).toContain('<CategoryDeleteDialog');
  });
});
