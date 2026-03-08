import { useCallback, useState } from 'react';

const useNotesFilters = ({ normalizeCategoryId, setActiveTab }) => {
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [searchId, setSearchId] = useState('');

  const handleCategorySelect = useCallback((categoryId) => {
    setActiveTab('notes');
    setActiveTag(null);
    setActiveCategory(categoryId ? normalizeCategoryId(categoryId) : null);
  }, [normalizeCategoryId, setActiveTab]);

  return {
    activeCategory,
    activeTag,
    handleCategorySelect,
    searchId,
    setActiveCategory,
    setActiveTag,
    setSearchId,
  };
};

export default useNotesFilters;
