import React from 'react';
import { Lock, RotateCcw, Trash2 } from 'lucide-react';

const TrashTab = ({
  formatDateTime,
  getNoteShortId,
  handlePermanentDeleteTrashedNote,
  handleRefreshTrash,
  handleRestoreTrashedNote,
  handleTrashAccessSubmit,
  isTrashLoading,
  setActiveTab,
  setTrashAccessState,
  trashAccessState,
  trashPendingNoteId,
  trashedNotes,
}) => (
  <div className="h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC]">
    {!trashAccessState.hasAccess ? (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-5 sm:space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">回收站</h2>
              <p className="mt-1 text-sm sm:text-base font-medium leading-7 text-slate-600">
                已删除的卡片会先进入这里。普通访客无法再访问它们，只有输入密码后才能查看、恢复或彻底删除。
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-xl rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-8 shadow-sm">
          <form className="space-y-4" onSubmit={handleTrashAccessSubmit}>
            <div>
              <label htmlFor="trash-password" className="text-sm font-black text-slate-700">回收站密码</label>
              <p className="mt-2 text-xs font-medium leading-6 text-slate-500">每次进入回收站都需要重新输入密码，本次只在当前进入过程中生效。</p>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                id="trash-password"
                type="password"
                autoComplete="off"
                className="w-full pl-11 pr-4 py-4 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:border-blue-300 focus:bg-white"
                placeholder="请输入回收站密码"
                value={trashAccessState.password}
                onChange={(e) => setTrashAccessState((prev) => ({ ...prev, password: e.target.value, error: '' }))}
              />
            </div>
            {trashAccessState.error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {trashAccessState.error}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className="px-5 py-3 text-sm font-bold text-slate-500"
              >
                先返回
              </button>
              <button
                type="submit"
                disabled={trashAccessState.isSubmitting}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-black shadow-lg shadow-blue-200 disabled:opacity-60"
              >
                {trashAccessState.isSubmitting ? '验证中...' : '进入回收站'}
              </button>
            </div>
          </form>
        </section>
      </div>
    ) : (
      <div className="h-full flex flex-col">
        <div className="px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
              <Trash2 size={18} />
            </div>
            <div>
              <h2 className="font-black text-lg">回收站</h2>
              <p className="text-xs font-semibold text-slate-500">当前区域受密码保护，仅本次进入有效。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefreshTrash}
            disabled={isTrashLoading}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 disabled:opacity-60"
          >
            {isTrashLoading ? '刷新中...' : '刷新回收站'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
          {isTrashLoading ? (
            <div className="h-full grid place-items-center text-slate-400 text-sm font-bold">回收站加载中...</div>
          ) : trashedNotes.length === 0 ? (
            <div className="h-full grid place-items-center text-slate-400 text-sm font-bold">回收站为空</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-8">
              {trashedNotes.map((note) => {
                const shortId = getNoteShortId(note);
                const isPending = trashPendingNoteId === note.id;
                const categoryName = String(note?.categories?.name || '').trim();
                const deletedLabel = formatDateTime(note?.deleted_at);
                return (
                  <div
                    key={`trash-${note.id}`}
                    className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 border border-blue-100 shadow-sm flex flex-col min-h-[240px] sm:min-h-[320px]"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700">
                          <Trash2 size={12} />
                          已删除
                        </span>
                        <div className="text-[10px] font-bold text-slate-400 font-mono">ID: {shortId || '-'}</div>
                      </div>
                      <div className="text-right text-[11px] font-semibold text-slate-400">
                        <div>删除于</div>
                        <div className="mt-1 text-slate-500">{deletedLabel}</div>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-800 mb-3 truncate">{String(note.title || '无标题')}</h3>
                    <div className="text-sm font-medium leading-7 text-slate-600 whitespace-pre-wrap break-words line-clamp-6 mb-4">
                      {String(note.content || '').trim() || '该卡片没有正文内容。'}
                    </div>

                    <div className="mt-auto pt-5 border-t border-slate-100 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                        <span className="px-2.5 py-1 rounded-full bg-slate-100">{categoryName || '未分类'}</span>
                        {Array.isArray(note?.tags) && note.tags.slice(0, 4).map((tag) => (
                          <span key={`${note.id}-${tag}`} className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">#{tag}</span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => handleRestoreTrashedNote(note)}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-200 disabled:opacity-60"
                        >
                          <RotateCcw size={14} />
                          {isPending ? '处理中...' : '恢复'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDeleteTrashedNote(note)}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-black border border-red-200 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          {isPending ? '处理中...' : '彻底删除'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

export default TrashTab;
