import React from 'react';
import { X } from 'lucide-react';

const NoteEditorModal = ({
  categories,
  categoryCreateError,
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
  newCategoryValue,
  normalizeCategoryId,
  onClose,
  saveError,
}) => {
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-2xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-black">{currentNote.id ? '编辑内容' : '新建内容'}</h3>
          <button onClick={onClose} aria-label="关闭编辑弹窗" className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          <input
            type="text"
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none"
            placeholder="标题..."
            value={currentNote.title}
            onChange={(event) => handleNoteTitleChange(event.target.value)}
          />
          <textarea
            rows="8"
            className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none resize-none"
            placeholder="Markdown 内容..."
            value={currentNote.content}
            onChange={(event) => handleNoteContentChange(event.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100"
              value={isAddingCategory ? newCategoryValue : (currentNote.category_id || '')}
              onChange={(event) => handleNoteCategorySelect(event.target.value)}
            >
              <option value="">未分类</option>
              {categories.map((category) => (
                <option key={category.id} value={normalizeCategoryId(category.id)}>{category.name}</option>
              ))}
              <option value={newCategoryValue}>+ 新增分类...</option>
            </select>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100"
              placeholder="标签 (逗号分隔)..."
              value={currentNote.tags?.join(', ')}
              onChange={(event) => handleNoteTagsChange(event.target.value)}
            />
          </div>
          {isAddingCategory && (
            <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  className="flex-1 p-3 bg-white rounded-xl border border-blue-100 outline-none"
                  placeholder="输入新分类名称..."
                  value={newCategoryName}
                  onChange={(event) => handleNewCategoryNameChange(event.target.value)}
                />
                <button onClick={handleCreateCategory} disabled={isCreatingCategory} className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-60">
                  {isCreatingCategory ? '创建中...' : '创建分类'}
                </button>
              </div>
              <p className="text-xs text-blue-700 font-semibold">创建成功后会自动选中该分类。</p>
            </div>
          )}
          {categoryCreateError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{categoryCreateError}</div>}
          {saveError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{saveError}</div>}
        </div>
        <div className="p-5 sm:p-8 border-t flex flex-wrap justify-end gap-4 bg-slate-50/50">
          <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold">放弃</button>
          <button onClick={handleSave} disabled={isSaving} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-60">{isSaving ? '保存中...' : '同步更改'}</button>
        </div>
      </div>
    </div>
  );
};

export default NoteEditorModal;
