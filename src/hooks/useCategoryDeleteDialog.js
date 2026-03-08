import { useCallback, useState } from 'react';
import { buildAdminPasswordHeaders } from '../trash';

const createEmptyCategoryDeleteState = () => ({
  isOpen: false,
  category: null,
  step: 1,
  password: '',
  error: '',
  isSubmitting: false,
});

const useCategoryDeleteDialog = ({
  activeCategory,
  connStatus,
  normalizeCategoryId,
  setActiveCategory,
  setCategories,
  setNotes,
  supabaseFuncUrl,
  withApiKeyHeaders,
}) => {
  const [categoryDeleteState, setCategoryDeleteState] = useState(() => createEmptyCategoryDeleteState());

  const closeCategoryDeleteDialog = useCallback(() => {
    setCategoryDeleteState(createEmptyCategoryDeleteState());
  }, []);

  const openCategoryDeleteDialog = useCallback((category) => {
    if (!category?.id) return;
    setCategoryDeleteState({
      isOpen: true,
      category,
      step: 1,
      password: '',
      error: '',
      isSubmitting: false,
    });
  }, []);

  const moveToCategoryDeletePasswordStep = useCallback(() => {
    setCategoryDeleteState((prev) => ({ ...prev, step: 2, error: '' }));
  }, []);

  const handleCategoryDeletePasswordChange = useCallback((password) => {
    setCategoryDeleteState((prev) => ({ ...prev, password, error: '' }));
  }, []);

  const handleCategoryDelete = useCallback(async () => {
    const target = categoryDeleteState.category;
    if (!target?.id || categoryDeleteState.isSubmitting) return;
    const targetCategoryId = normalizeCategoryId(target.id);
    const password = String(categoryDeleteState.password || '').trim();

    if (!password) {
      setCategoryDeleteState((prev) => ({ ...prev, error: '请输入删除密码。' }));
      return;
    }

    setCategoryDeleteState((prev) => ({ ...prev, error: '', isSubmitting: true }));
    try {
      if (connStatus === 'offline') {
        setCategories((prev) => prev.filter((item) => item.id !== target.id));
        setNotes((prev) => prev.map((note) => (normalizeCategoryId(note.category_id) === targetCategoryId ? { ...note, category_id: null } : note)));
        if (normalizeCategoryId(activeCategory) === targetCategoryId) setActiveCategory(null);
        closeCategoryDeleteDialog();
        return;
      }

      const response = await fetch(`${supabaseFuncUrl}/categories/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: buildAdminPasswordHeaders(password, withApiKeyHeaders()),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `删除分类失败 (HTTP ${response.status})`);
      }

      setCategories((prev) => prev.filter((item) => item.id !== target.id));
      setNotes((prev) => prev.map((note) => (normalizeCategoryId(note.category_id) === targetCategoryId ? { ...note, category_id: null } : note)));
      if (normalizeCategoryId(activeCategory) === targetCategoryId) setActiveCategory(null);
      closeCategoryDeleteDialog();
    } catch (error) {
      setCategoryDeleteState((prev) => ({ ...prev, isSubmitting: false, error: String(error.message || error) }));
    }
  }, [activeCategory, categoryDeleteState, closeCategoryDeleteDialog, connStatus, normalizeCategoryId, setActiveCategory, setCategories, setNotes, supabaseFuncUrl, withApiKeyHeaders]);

  return {
    categoryDeleteState,
    closeCategoryDeleteDialog,
    handleCategoryDelete,
    handleCategoryDeletePasswordChange,
    moveToCategoryDeletePasswordStep,
    openCategoryDeleteDialog,
  };
};

export default useCategoryDeleteDialog;
