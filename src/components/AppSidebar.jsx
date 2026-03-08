import React from 'react';
import { BookOpen, LayoutGrid, Settings, Trash2, X } from 'lucide-react';

const AppSidebar = ({
  activeCategory,
  activeTab,
  appVersionLabel,
  categories,
  handleCategorySelect,
  handleDesktopTrashAreaEnter,
  handleDesktopTrashAreaLeave,
  isDesktopTrashButtonVisible,
  isMobileSidebarOpen,
  normalizeCategoryId,
  noteCountByCategory,
  onCloseMobileSidebar,
  onOpenCategoryDeleteDialog,
  onOpenGuide,
  onOpenTrash,
}) => (
  <aside className={`fixed inset-y-0 left-0 z-[1100] w-[17rem] border-r border-slate-200 bg-white flex flex-col shrink-0 transition-transform duration-200 ease-out md:relative md:z-auto md:w-64 md:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:shadow-none'}`}>
    <div className="p-6 h-full flex flex-col">
      <div className="mb-8 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0"><span className="text-white font-bold text-xl">T</span></div>
          <h1 className="inline-flex min-w-0 items-end gap-1 text-2xl font-black tracking-tight leading-none">
            <span className="leading-none truncate">TextFlow.</span>
            <span className="relative -top-[1px] text-[0.8em] leading-none shrink-0">{'\u6587\u6d41'}</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={onCloseMobileSidebar}
          className="md:hidden p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          aria-label={'\u5173\u95ed\u5bfc\u822a'}
        >
          <X size={16} />
        </button>
      </div>
      <nav className="space-y-1 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
        <button
          type="button"
          onClick={onOpenGuide}
          className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === 'guide' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <BookOpen size={18} /> {'\u4f7f\u7528\u6307\u5357'}
        </button>
        <button
          onClick={() => handleCategorySelect(null)}
          className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === 'notes' && !activeCategory ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <LayoutGrid size={18} /> {'\u5168\u90e8\u5185\u5bb9'}
        </button>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4 ml-4">{'\u5206\u7c7b\u7a7a\u95f4'}</p>
        {Array.isArray(categories) && categories.map((category) => {
          const categoryKey = normalizeCategoryId(category?.id);
          const isActive = activeTab === 'notes' && normalizeCategoryId(activeCategory) === categoryKey;
          const count = noteCountByCategory.get(categoryKey) || 0;
          return (
            <div key={category.id} className={`group flex items-center justify-between px-4 py-2.5 rounded-xl ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
              <button
                type="button"
                onClick={() => handleCategorySelect(categoryKey)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <span className="truncate">{category.name}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCategoryDeleteDialog(category)}
                className="ml-2 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                title={'\u5220\u9664\u5206\u7c7b'}
                aria-label={`\u5220\u9664\u5206\u7c7b ${category.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto pt-6">
        <div onMouseEnter={handleDesktopTrashAreaEnter} onMouseLeave={handleDesktopTrashAreaLeave}>
          <button
            type="button"
            onClick={onOpenTrash}
            aria-label={'\u6253\u5f00\u56de\u6536\u7ad9'}
            className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-opacity duration-200 ${isDesktopTrashButtonVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${activeTab === 'trash' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Trash2 size={18} /> {'\u56de\u6536\u7ad9'}
          </button>
        </div>
        <button
          type="button"
          onClick={onOpenTrash}
          className={`md:hidden w-full px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === 'trash' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Trash2 size={18} /> {'\u56de\u6536\u7ad9'}
        </button>
        <div className="pt-6 text-slate-300 text-[10px] font-bold flex items-center justify-center gap-2 text-center"><Settings size={12} /> {appVersionLabel}</div>
      </div>
    </div>
  </aside>
);

export default AppSidebar;
