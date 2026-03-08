export const TRASH_BUTTON_REVEAL_DELAY_MS = 5000;

export const createTrashAccessState = () => ({
  isOpen: false,
  password: '',
  error: '',
  isSubmitting: false,
  hasAccess: false,
});

export const isTrashedNote = (note) => Boolean(note?.deleted_at);

export const getVisibleNotes = (notes) => (Array.isArray(notes) ? notes.filter((note) => !isTrashedNote(note)) : []);

export const buildAdminPasswordHeaders = (password, headers = undefined) => {
  const merged = new Headers(headers || {});
  const normalized = String(password || '').trim();
  if (normalized) merged.set('x-admin-password', normalized);
  return merged;
};

export const sortTrashedNotes = (notes) => (
  Array.isArray(notes)
    ? [...notes].sort((a, b) => Date.parse(b?.deleted_at || 0) - Date.parse(a?.deleted_at || 0))
    : []
);

export const removeNoteById = (notes, noteId) => (
  Array.isArray(notes)
    ? notes.filter((note) => String(note?.id || '') !== String(noteId || ''))
    : []
);

export const upsertNoteAtTop = (notes, nextNote) => {
  if (!nextNote?.id) return Array.isArray(notes) ? [...notes] : [];
  return [nextNote, ...removeNoteById(notes, nextNote.id)];
};
