import { useCallback, useEffect, useReducer } from 'react';
import {
  buildAdminPasswordHeaders,
  createTrashAccessState,
  removeNoteById,
  sortTrashedNotes,
  upsertNoteAtTop,
} from '../trash';

const createTrashState = () => ({
  trashAccessState: createTrashAccessState(),
  trashedNotes: [],
  isTrashLoading: false,
  trashPendingNoteId: '',
});

const trashReducer = (state, action) => {
  switch (action.type) {
    case 'reset':
      return createTrashState();
    case 'open':
      return {
        ...createTrashState(),
        trashAccessState: { ...createTrashAccessState(), isOpen: true },
      };
    case 'lock':
      return {
        ...createTrashState(),
        trashAccessState: {
          ...createTrashAccessState(),
          isOpen: true,
          error: String(action.message || '').trim(),
        },
      };
    case 'setAccessState': {
      const nextAccessState = typeof action.value === 'function'
        ? action.value(state.trashAccessState)
        : action.value;
      return { ...state, trashAccessState: nextAccessState };
    }
    case 'setLoading':
      return { ...state, isTrashLoading: Boolean(action.value) };
    case 'setNotes':
      return { ...state, trashedNotes: Array.isArray(action.value) ? action.value : [] };
    case 'setPendingNoteId':
      return { ...state, trashPendingNoteId: String(action.value || '') };
    case 'removeNote':
      return { ...state, trashedNotes: removeNoteById(state.trashedNotes, action.noteId) };
    default:
      return state;
  }
};

const useTrashManager = ({
  activeTab,
  fetchData,
  normalizeNotes,
  setActiveTab,
  setNotes,
  setViewingNote,
  showToast,
  supabaseFuncUrl,
  withApiKeyHeaders,
}) => {
  const [state, dispatch] = useReducer(trashReducer, undefined, createTrashState);
  const {
    trashAccessState,
    trashedNotes,
    isTrashLoading,
    trashPendingNoteId,
  } = state;

  useEffect(() => {
    if (activeTab === 'trash') return;
    dispatch({ type: 'reset' });
  }, [activeTab]);

  const setTrashAccessState = useCallback((value) => {
    dispatch({ type: 'setAccessState', value });
  }, []);

  const lockTrashAccess = useCallback((message = '') => {
    dispatch({ type: 'lock', message });
  }, []);

  const fetchTrashNotes = useCallback(async (password) => {
    const response = await fetch(`${supabaseFuncUrl}/trash/notes`, {
      headers: buildAdminPasswordHeaders(password, withApiKeyHeaders()),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.ok === false) {
      const error = result?.error || `获取回收站失败 (HTTP ${response.status})`;
      const wrapped = new Error(error);
      wrapped.status = response.status;
      throw wrapped;
    }
    return sortTrashedNotes(normalizeNotes(result?.data));
  }, [normalizeNotes, supabaseFuncUrl, withApiKeyHeaders]);

  const openTrashTab = useCallback(() => {
    setViewingNote(null);
    dispatch({ type: 'open' });
    setActiveTab('trash');
  }, [setActiveTab, setViewingNote]);

  const handleTrashAccessSubmit = useCallback(async (event) => {
    event?.preventDefault?.();
    const password = String(trashAccessState.password || '').trim();
    if (!password || trashAccessState.isSubmitting) {
      setTrashAccessState((prev) => ({
        ...prev,
        error: password ? prev.error : '请输入回收站密码。',
      }));
      return;
    }

    setTrashAccessState((prev) => ({ ...prev, error: '', isSubmitting: true }));
    dispatch({ type: 'setLoading', value: true });
    try {
      const items = await fetchTrashNotes(password);
      dispatch({ type: 'setNotes', value: items });
      setTrashAccessState((prev) => ({ ...prev, error: '', isSubmitting: false, hasAccess: true }));
    } catch (error) {
      dispatch({ type: 'setNotes', value: [] });
      setTrashAccessState((prev) => ({
        ...prev,
        hasAccess: false,
        isSubmitting: false,
        error: String(error.message || error),
      }));
    } finally {
      dispatch({ type: 'setLoading', value: false });
    }
  }, [fetchTrashNotes, setTrashAccessState, trashAccessState.isSubmitting, trashAccessState.password]);

  const handleRefreshTrash = useCallback(async () => {
    const password = String(trashAccessState.password || '').trim();
    if (!password || !trashAccessState.hasAccess || isTrashLoading) return;

    dispatch({ type: 'setLoading', value: true });
    try {
      const items = await fetchTrashNotes(password);
      dispatch({ type: 'setNotes', value: items });
      setTrashAccessState((prev) => ({ ...prev, error: '' }));
    } catch (error) {
      const message = String(error.message || error);
      if (error?.status === 403) {
        lockTrashAccess(message);
        return;
      }
      showToast(message);
    } finally {
      dispatch({ type: 'setLoading', value: false });
    }
  }, [fetchTrashNotes, isTrashLoading, lockTrashAccess, setTrashAccessState, showToast, trashAccessState.hasAccess, trashAccessState.password]);

  const handleRestoreTrashedNote = useCallback(async (note) => {
    const noteId = String(note?.id || '').trim();
    const password = String(trashAccessState.password || '').trim();
    if (!noteId || !password || trashPendingNoteId) return;

    dispatch({ type: 'setPendingNoteId', value: noteId });
    try {
      const response = await fetch(`${supabaseFuncUrl}/trash/notes/${encodeURIComponent(noteId)}/restore`, {
        method: 'POST',
        headers: buildAdminPasswordHeaders(password, withApiKeyHeaders()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        const error = result?.error || `恢复失败 (HTTP ${response.status})`;
        const wrapped = new Error(error);
        wrapped.status = response.status;
        throw wrapped;
      }

      const restoredNote = normalizeNotes([result?.data])[0] || null;
      dispatch({ type: 'removeNote', noteId });
      if (restoredNote?.id) {
        setNotes((prev) => upsertNoteAtTop(prev, restoredNote));
      } else {
        await fetchData();
      }
      showToast('已恢复到文字流', 'success');
    } catch (error) {
      const message = String(error.message || error);
      if (error?.status === 403) {
        lockTrashAccess(message);
        return;
      }
      showToast(message);
    } finally {
      dispatch({ type: 'setPendingNoteId', value: '' });
    }
  }, [fetchData, lockTrashAccess, normalizeNotes, setNotes, showToast, supabaseFuncUrl, trashAccessState.password, trashPendingNoteId, withApiKeyHeaders]);

  const handlePermanentDeleteTrashedNote = useCallback(async (note) => {
    const noteId = String(note?.id || '').trim();
    const password = String(trashAccessState.password || '').trim();
    if (!noteId || !password || trashPendingNoteId) return;
    if (!window.confirm('确认彻底删除这条回收站笔记吗？')) return;

    dispatch({ type: 'setPendingNoteId', value: noteId });
    try {
      const response = await fetch(`${supabaseFuncUrl}/trash/notes/${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
        headers: buildAdminPasswordHeaders(password, withApiKeyHeaders()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        const error = result?.error || `彻底删除失败 (HTTP ${response.status})`;
        const wrapped = new Error(error);
        wrapped.status = response.status;
        throw wrapped;
      }

      dispatch({ type: 'removeNote', noteId });
      showToast('已彻底删除', 'success');
    } catch (error) {
      const message = String(error.message || error);
      if (error?.status === 403) {
        lockTrashAccess(message);
        return;
      }
      showToast(message);
    } finally {
      dispatch({ type: 'setPendingNoteId', value: '' });
    }
  }, [lockTrashAccess, showToast, supabaseFuncUrl, trashAccessState.password, trashPendingNoteId, withApiKeyHeaders]);

  return {
    handlePermanentDeleteTrashedNote,
    handleRefreshTrash,
    handleRestoreTrashedNote,
    handleTrashAccessSubmit,
    isTrashLoading,
    lockTrashAccess,
    openTrashTab,
    setTrashAccessState,
    trashAccessState,
    trashPendingNoteId,
    trashedNotes,
  };
};

export default useTrashManager;
