import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, SquarePen, Tag, Trash2 } from 'lucide-react';

const NotesTab = ({
  MarkdownLink,
  activeCategory,
  activeCategoryName,
  activeTag,
  allTags,
  categories,
  copiedToken,
  copyText,
  filteredNotes,
  getNoteShortId,
  handleCategorySelect,
  markdownPlugins,
  normalizeCategoryId,
  onEditNote,
  onViewNote,
  requestDeleteNote,
  setActiveTag,
  toDisplayMarkdown,
}) => (
  <div className="h-full flex flex-col bg-[#F8FAFC]">
    <div className="md:hidden px-4 py-3 bg-white/70">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button type="button" onClick={() => handleCategorySelect(null)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${!activeCategory ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>全部分类</button>
        {categories.map((category) => {
          const categoryKey = normalizeCategoryId(category?.id);
          const isActive = normalizeCategoryId(activeCategory) === categoryKey;
          return (
            <button
              key={`mobile-${category.id}`}
              type="button"
              onClick={() => handleCategorySelect(categoryKey)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>

    <div className="px-4 sm:px-8 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar bg-white/50">
      <Tag size={14} className="text-slate-400 shrink-0" />
      <button onClick={() => setActiveTag(null)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${!activeTag ? 'bg-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>全部标签</button>
      {allTags.map((tag) => (
        <button key={tag} onClick={() => setActiveTag(tag)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${activeTag === tag ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>#{tag}</button>
      ))}
    </div>

    {activeCategoryName && (
      <div className="px-4 sm:px-8 py-3 bg-blue-50/60 text-xs font-semibold text-blue-700">
        当前分类: {activeCategoryName} ({filteredNotes.length} 条)
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
      {filteredNotes.length === 0 ? (
        <div className="h-full grid place-items-center text-slate-400 text-sm font-bold">暂无匹配笔记</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-8">
          {filteredNotes.map((note) => {
            const shortId = getNoteShortId(note);
            const noteTextToken = `note-text-${note.id}`;
            const noteIdToken = `note-id-${note.id}`;
            const isTextCopied = copiedToken === noteTextToken;
            const isIdCopied = copiedToken === noteIdToken;
            return (
              <div
                key={note.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewNote(note)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onViewNote(note);
                  }
                }}
                className="tf-note-item bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 border border-slate-200 shadow-sm hover:shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col min-h-[220px] sm:min-h-[300px]"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {shortId || '-'}</span>
                    <button
                      onClick={(event) => { event.stopPropagation(); copyText(shortId, noteIdToken); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                    >
                      <Copy size={12} />
                      {isIdCopied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <button
                    onClick={(event) => { event.stopPropagation(); onEditNote(note); }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                  >
                    <SquarePen size={12} />
                    编辑
                  </button>
                </div>

                <h3 className="text-xl font-black text-slate-800 mb-3 truncate">{String(note.title || '无标题')}</h3>
                <div className="tf-markdown prose prose-sm prose-slate prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 text-slate-600 line-clamp-6 mb-4 font-medium">
                  <ReactMarkdown
                    remarkPlugins={markdownPlugins}
                    components={{ a: MarkdownLink }}
                  >
                    {toDisplayMarkdown(note.content)}
                  </ReactMarkdown>
                </div>

                <div className="mt-auto pt-5 border-t border-slate-50 flex items-center justify-between">
                  <button
                    onClick={(event) => { event.stopPropagation(); copyText(note.content, noteTextToken); }}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                  >
                    {isTextCopied ? '已复制文本' : '复制文本'}
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); requestDeleteNote(note.id); }} aria-label={`删除卡片 ${String(note.title || '无标题')}`} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

export default NotesTab;
