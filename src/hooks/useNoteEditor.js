import { useCallback, useReducer } from 'react';

const cloneEmptyNote = (emptyNote) => ({
  id: emptyNote?.id ?? null,
  title: emptyNote?.title || '',
  content: emptyNote?.content || '',
  category_id: emptyNote?.category_id || '',
  tags: Array.isArray(emptyNote?.tags) ? [...emptyNote.tags] : [],
});

const createNoteEditorState = (emptyNote) => ({
  isModalOpen: false,
  currentNote: cloneEmptyNote(emptyNote),
  saveError: '',
  isSaving: false,
  isAddingCategory: false,
  newCategoryName: '',
  categoryCreateError: '',
  isCreatingCategory: false,
});

const noteEditorReducer = (state, action) => {
  switch (action.type) {
    case 'open':
      return {
        ...createNoteEditorState(action.emptyNote),
        isModalOpen: true,
        currentNote: action.currentNote,
      };
    case 'close':
      return createNoteEditorState(action.emptyNote);
    case 'merge':
      return { ...state, ...action.payload };
    case 'patchNote':
      return { ...state, currentNote: { ...state.currentNote, ...action.payload } };
    default:
      return state;
  }
};

const useNoteEditor = ({
  activeCategory,
  activeTag,
  categories,
  connStatus,
  createLocalShortId,
  emptyNote,
  fetchData,
  notes,
  normalizeCategoryId,
  setActiveTab,
  setCategories,
  setNotes,
  supabaseFuncUrl,
  withApiKeyHeaders,
  withShortId,
}) => {
  const [state, dispatch] = useReducer(noteEditorReducer, emptyNote, createNoteEditorState);
  const {
    isModalOpen,
    currentNote,
    saveError,
    isSaving,
    isAddingCategory,
    newCategoryName,
    categoryCreateError,
    isCreatingCategory,
  } = state;

  const closeNoteModal = useCallback(() => {
    dispatch({ type: 'close', emptyNote });
  }, [emptyNote]);

  const openNewNoteModal = useCallback(() => {
    setActiveTab('notes');
    dispatch({
      type: 'open',
      emptyNote,
      currentNote: {
        ...cloneEmptyNote(emptyNote),
        category_id: normalizeCategoryId(activeCategory) || '',
        tags: activeTag ? [activeTag] : [],
      },
    });
  }, [activeCategory, activeTag, emptyNote, normalizeCategoryId, setActiveTab]);

  const openEditNoteModal = useCallback((note) => {
    dispatch({
      type: 'open',
      emptyNote,
      currentNote: {
        id: note?.id || null,
        title: note?.title || '',
        content: note?.content || '',
        category_id: normalizeCategoryId(note?.category_id) || '',
        tags: Array.isArray(note?.tags) ? note.tags : [],
      },
    });
  }, [emptyNote, normalizeCategoryId]);

  const handleNoteTitleChange = useCallback((value) => {
    dispatch({ type: 'patchNote', payload: { title: value } });
  }, []);

  const handleNoteContentChange = useCallback((value) => {
    dispatch({ type: 'patchNote', payload: { content: value } });
  }, []);

  const handleNoteTagsChange = useCallback((value) => {
    dispatch({
      type: 'patchNote',
      payload: {
        tags: String(value || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    });
  }, []);

  const handleNewCategoryNameChange = useCallback((value) => {
    dispatch({ type: 'merge', payload: { newCategoryName: value, categoryCreateError: '' } });
  }, []);

  const handleNoteCategorySelect = useCallback((nextValue) => {
    if (nextValue === '__new_category__') {
      dispatch({
        type: 'merge',
        payload: {
          isAddingCategory: true,
          categoryCreateError: '',
          currentNote: { ...state.currentNote, category_id: '' },
        },
      });
      return;
    }

    dispatch({
      type: 'merge',
      payload: {
        isAddingCategory: false,
        categoryCreateError: '',
        currentNote: {
          ...state.currentNote,
          category_id: normalizeCategoryId(nextValue),
        },
      },
    });
  }, [normalizeCategoryId, state.currentNote]);

  const handleCreateCategory = useCallback(async () => {
    const name = String(newCategoryName || '').trim();
    if (!name) {
      dispatch({ type: 'merge', payload: { categoryCreateError: '请输入分类名称。' } });
      return;
    }

    const exists = (categories || []).some((item) => String(item?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      dispatch({ type: 'merge', payload: { categoryCreateError: '分类已存在，请使用其他名称。' } });
      return;
    }

    dispatch({ type: 'merge', payload: { categoryCreateError: '', isCreatingCategory: true } });
    try {
      if (connStatus === 'offline') {
        const localCategory = { id: `local-cat-${Date.now()}`, name };
        setCategories((prev) => [...prev, localCategory]);
        dispatch({
          type: 'merge',
          payload: {
            currentNote: {
              ...state.currentNote,
              category_id: normalizeCategoryId(localCategory.id),
            },
            isAddingCategory: false,
            newCategoryName: '',
          },
        });
        return;
      }

      const response = await fetch(`${supabaseFuncUrl}/categories`, {
        method: 'POST',
        headers: withApiKeyHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `新增分类失败 (HTTP ${response.status})`);
      }

      const created = result?.data;
      if (!created?.id) throw new Error('新增分类失败：未返回分类ID。');
      setCategories((prev) => [...prev, created]);
      dispatch({
        type: 'merge',
        payload: {
          currentNote: {
            ...state.currentNote,
            category_id: normalizeCategoryId(created.id),
          },
          isAddingCategory: false,
          newCategoryName: '',
        },
      });
    } catch (error) {
      dispatch({ type: 'merge', payload: { categoryCreateError: String(error.message || error) } });
    } finally {
      dispatch({ type: 'merge', payload: { isCreatingCategory: false } });
    }
  }, [categories, connStatus, newCategoryName, normalizeCategoryId, setCategories, state.currentNote, supabaseFuncUrl, withApiKeyHeaders]);

  const handleSave = useCallback(async () => {
    const payload = {
      ...currentNote,
      title: String(currentNote.title || '').trim(),
      content: String(currentNote.content || '').trim(),
      category_id: currentNote.category_id || null,
      tags: Array.isArray(currentNote.tags) ? currentNote.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    };

    if (!payload.title && !payload.content) {
      dispatch({ type: 'merge', payload: { saveError: '请至少填写标题或内容。' } });
      return;
    }

    dispatch({ type: 'merge', payload: { saveError: '', isSaving: true } });
    try {
      if (connStatus === 'offline') {
        const existingIds = new Set((notes || []).map((note) => String(note?.id || '')));
        let localId = payload.id || createLocalShortId();
        if (!payload.id) {
          while (existingIds.has(localId)) localId = createLocalShortId();
        }
        const localNote = withShortId({ ...payload, id: localId, created_at: new Date().toISOString() });
        setNotes((prev) => payload.id ? prev.map((note) => (note.id === payload.id ? localNote : note)) : [localNote, ...prev]);
        closeNoteModal();
        return;
      }

      const response = await fetch(`${supabaseFuncUrl}/notes`, {
        method: 'POST',
        headers: withApiKeyHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || `保存失败 (HTTP ${response.status})`);

      const savedNote = withShortId(result?.data);
      if (savedNote?.id) {
        setNotes((prev) => {
          const exists = prev.some((note) => note.id === savedNote.id);
          return exists ? prev.map((note) => (note.id === savedNote.id ? savedNote : note)) : [savedNote, ...prev];
        });
      } else {
        await fetchData();
      }
      closeNoteModal();
    } catch (error) {
      dispatch({ type: 'merge', payload: { saveError: String(error.message || error) } });
    } finally {
      dispatch({ type: 'merge', payload: { isSaving: false } });
    }
  }, [closeNoteModal, connStatus, createLocalShortId, currentNote, fetchData, notes, setNotes, supabaseFuncUrl, withApiKeyHeaders, withShortId]);

  return {
    categoryCreateError,
    closeNoteModal,
    currentNote,
    handleCreateCategory,
    handleNewCategoryNameChange,
    handleNoteCategorySelect,
    handleNoteContentChange,
    handleNoteTagsChange,
    handleNoteTitleChange,
    handleSave,
    isAddingCategory,
    isCreatingCategory,
    isModalOpen,
    isSaving,
    newCategoryName,
    openEditNoteModal,
    openNewNoteModal,
    saveError,
  };
};

export default useNoteEditor;
