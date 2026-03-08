import React from 'react';
import { Menu, Plus, Search } from 'lucide-react';

const AppHeader = ({
  activeTab,
  onOpenMobileSidebar,
  onOpenNewNoteModal,
  searchId,
  setActiveTab,
  setSearchId,
}) => (
  <header className="bg-white px-4 sm:px-6 lg:px-8 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-5 shrink-0 z-10">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex items-end gap-1 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('notes')} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-t-2xl text-xs sm:text-sm font-black whitespace-nowrap ${activeTab === 'notes' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>文字流</button>
        <button onClick={() => setActiveTab('chat')} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-t-2xl text-xs sm:text-sm font-black whitespace-nowrap ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>AI文字助手</button>
        <button onClick={() => setActiveTab('roomchat')} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-t-2xl text-xs sm:text-sm font-black whitespace-nowrap ${activeTab === 'roomchat' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>流式聊天</button>
      </div>
      <div className="w-full sm:w-auto sm:ml-auto pb-3 sm:pb-4 flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          aria-label="打开侧边栏"
        >
          <Menu size={18} />
        </button>
        <div className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
          <input type="text" name="note-search-id" autoComplete="off" placeholder="搜索短ID / 全ID..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-full text-xs w-full sm:w-56 focus:outline-none focus:bg-white border border-transparent focus:border-blue-100" value={searchId} onChange={(event) => setSearchId(event.target.value)} />
        </div>
        <button onClick={onOpenNewNoteModal} aria-label="新建卡片" className="p-2.5 sm:p-3 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 shrink-0"><Plus size={22} /></button>
      </div>
    </div>
  </header>
);

export default AppHeader;
