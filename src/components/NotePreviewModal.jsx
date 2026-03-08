import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';

const NotePreviewModal = ({
  MarkdownLink,
  copiedToken,
  copyText,
  getNoteExternalFetchUrl,
  getNoteShortId,
  markdownPlugins,
  note,
  onClose,
  onEdit,
  toDisplayMarkdown,
}) => {
  if (!note) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 sm:px-8 md:px-10 py-5 sm:py-6 md:py-8 bg-white flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h3 className="text-xl md:text-2xl font-black truncate">{String(note.title || '正文')}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-5 font-mono">短ID: {getNoteShortId(note) || '-'}</p>
          </div>
          <button onClick={onClose} aria-label="关闭预览" className="p-2 border rounded-full hover:bg-slate-50 shrink-0"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50/70">
          <article className="max-w-[53rem] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 md:py-10">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8">
              <div className="tf-markdown tf-full-note prose prose-slate prose-lg prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 max-w-none leading-8">
                <ReactMarkdown remarkPlugins={markdownPlugins} components={{ a: MarkdownLink }}>
                  {toDisplayMarkdown(note.content)}
                </ReactMarkdown>
              </div>
            </div>
          </article>
        </div>
        <div className="p-4 sm:p-8 flex flex-wrap items-center justify-end gap-3 bg-slate-50/50">
          <button
            onClick={() => copyText(note.content, `view-note-text-${note.id}`)}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
          >
            {copiedToken === `view-note-text-${note.id}` ? '已复制正文' : '复制正文'}
          </button>
          <button
            onClick={() => copyText(getNoteShortId(note), `view-note-id-${note.id}`)}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
          >
            {copiedToken === `view-note-id-${note.id}` ? '已复制ID' : '复制ID'}
          </button>
          <button
            onClick={() => copyText(getNoteExternalFetchUrl(note), `view-note-link-${note.id}`)}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
          >
            {copiedToken === `view-note-link-${note.id}` ? '已复制调取链接' : '复制调取链接'}
          </button>
          <button onClick={() => onEdit(note)} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold">编辑内容</button>
        </div>
      </div>
    </div>
  );
};

export default NotePreviewModal;
