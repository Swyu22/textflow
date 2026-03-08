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
