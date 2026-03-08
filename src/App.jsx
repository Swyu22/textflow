import React, { useCallback, useEffect, useMemo, useState } from 'react';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { getVisibleNotes } from './trash';
import useChatAssistant from './chat/useChatAssistant';
import useAppChrome from './hooks/useAppChrome';
import useNotesFilters from './hooks/useNotesFilters';
import useCategoryDeleteDialog from './hooks/useCategoryDeleteDialog';
import useNoteEditor from './hooks/useNoteEditor';
import useTrashManager from './hooks/useTrashManager';
import NoteEditorModal from './components/NoteEditorModal';
import CategoryDeleteDialog from './components/CategoryDeleteDialog';
import NotePreviewModal from './components/NotePreviewModal';
import NotesTab from './components/NotesTab';
import AppSidebar from './components/AppSidebar';
import GuideTab from './components/GuideTab';
import AppHeader from './components/AppHeader';
import AppOverlays from './components/AppOverlays';
import { SUPABASE_FUNC_URL, SUPABASE_PUBLISHABLE_KEY } from './supabaseConfig';

const { Suspense, lazy } = React;
const EmbeddedChatRoomTab = lazy(() => import('./chat/EmbeddedChatRoomTab'));
const TrashTab = lazy(() => import('./components/TrashTab'));
const ChatAssistantTab = lazy(() => import('./components/ChatAssistantTab'));

const EMPTY_NOTE = { id: null, title: '', content: '', category_id: '', tags: [] };
const SHORT_ID_LENGTH = 8;
const NEW_CATEGORY_VALUE = '__new_category__';
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];
const RELEASE_BASE_VERSION = '1.0.8';
const RELEASE_CHANNEL = 'stable';
const RELEASE_UPDATES = [
  { level: 'minor', label: 'notes-recycle-bin' },
  { level: 'minor', label: 'guide-page-and-sidebar-polish' },
  { level: 'patch', label: 'supabase-api-key-header' },
  { level: 'patch', label: 'chat-layout-bottom-scroll' },
  { level: 'patch', label: 'chat-content-wrap-fix' },
  { level: 'patch', label: 'react-perf-optimizations' },
  { level: 'patch', label: 'a11y-and-style-hardening' },
  { level: 'patch', label: 'responsive-web-mobile-adaptation' },
  { level: 'minor', label: 'chat-zero-retention-and-recycle-bin-hardening' },
  { level: 'patch', label: 'shared-supabase-config' },
  { level: 'patch', label: 'app-shell-refactor' },
  { level: 'patch', label: 'sidebar-bottom-anchor-fix' },
];
const GUIDE_SECTIONS = [
  {
    title: '1. 初次使用',
    points: [
      '左侧点击“全部内容”查看所有文字卡片，再按分类或标签快速筛选。',
      '右上角“+”按钮可新建卡片，支持标题、正文、分类与标签。',
      '点击卡片可进入全文页，支持复制正文、复制短ID与复制调取链接。',
      '删除卡片不会立刻彻底清除，而是先移入回收站，输入密码后可恢复或彻底删除。',
    ],
  },
  {
    title: '2. 分类与检索',
    points: [
      '左侧分类支持聚合显示，点击分类后仅展示对应卡片。',
      '顶部搜索框可按8位短ID或完整ID检索卡片。',
      '删除分类时需要二次确认和密码，分类下卡片会自动改为未分类。',
    ],
  },
  {
    title: '3. AI文字助手',
    points: [
      '可在 DeepSeek、Gemini、ChatGPT 之间切换，模型上下文按模型分别保存。',
      '前置提示词支持输入短ID拉取正文，作为当前会话的临时上下文。',
      '提问与回答都支持一键复制，刷新页面后会话记录自动清空。',
    ],
  },
  {
    title: '4. 站内调取与安全',
    points: [
      '每张卡片都带8位短ID，站内可通过短ID调取对应纯文本信息。',
      '调取接口仅返回文本正文，便于接入脚本、自动化或其他系统。',
      '文流仅供与众内部使用，请勿外传避免无关人员访问敏感内容。',
    ],
  },
];

const parseSemver = (version) => {
  const parts = String(version || '').split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part < 0)) return [1, 0, 0];
  return parts;
};
const bumpSemverByLevel = ([major, minor, patch], level) => {
  if (level === 'major') return [major + 1, 0, 0];
  if (level === 'minor') return [major, minor + 1, 0];
  return [major, minor, patch + 1];
};
const buildReleaseVersion = (baseVersion, updates) => (updates || [])
  .reduce((acc, update) => bumpSemverByLevel(acc, update?.level), parseSemver(baseVersion))
  .join('.');
const APP_VERSION_LABEL = 'V' + buildReleaseVersion(RELEASE_BASE_VERSION, RELEASE_UPDATES) + ' ' + RELEASE_CHANNEL.toUpperCase();

const formatDateTime = (value) => {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '未知时间';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
};
const toShortId = (rawId) => String(rawId ?? '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, SHORT_ID_LENGTH)
  .toUpperCase();
const createLocalShortId = () => {
  let candidate = '';
  while (candidate.length < SHORT_ID_LENGTH) candidate += Math.random().toString(36).slice(2).toUpperCase();
  return candidate.slice(0, SHORT_ID_LENGTH);
};
const normalizeCategoryId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};
const withShortId = (note) => {
  if (!note || typeof note !== 'object') return note;
  const shortId = toShortId(note.short_id || note.id);
  const categoryId = normalizeCategoryId(note.category_id);
  if (shortId) return { ...note, short_id: shortId, category_id: categoryId || null };
  return { ...note, category_id: categoryId || null };
};
const normalizeNotes = (items) => (Array.isArray(items) ? items.map((item) => withShortId(item)) : []);
const getNoteShortId = (note) => toShortId(note?.short_id || note?.id);
const getNoteExternalFetchUrl = (note) => {
  const shortId = getNoteShortId(note);
  return shortId ? `${SUPABASE_FUNC_URL}/notes/${encodeURIComponent(shortId)}/text` : '';
};
const normalizeHttpUrl = (value) => {
  const link = String(value || '').trim();
  if (!/^https?:\/\//i.test(link)) return '';
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
};
const toDisplayMarkdown = (value) => String(value || '')
  .replace(/\\r\\n/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/\n/g, '  \n');
const MarkdownLink = ({ href, ...props }) => {
  const safeHref = normalizeHttpUrl(href);
  if (!safeHref) {
    return (
      <span
        {...props}
        className="text-slate-500 underline underline-offset-2 break-all"
      />
    );
  }
  return (
    <a
      {...props}
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { e.stopPropagation(); }}
      className="text-blue-600 underline underline-offset-2 break-all hover:text-blue-700"
    />
  );
};

const withApiKeyHeaders = (headers = undefined) => {
  const merged = new Headers(headers || {});
  if (SUPABASE_PUBLISHABLE_KEY) merged.set('apikey', SUPABASE_PUBLISHABLE_KEY);
  return merged;
};
const LazyTabFallback = ({ label }) => (
  <div className="h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC]">
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-8 shadow-sm text-center text-sm font-semibold text-slate-500">
        {label}加载中...
      </div>
    </div>
  </div>
);

const App = () => {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [connection, setConnection] = useState({ status: 'checking', errorMessage: '' });
  const connStatus = connection.status;
  const connErrorMessage = connection.errorMessage;

  const {
    closeMobileSidebar,
    copiedToken,
    copyText,
    dismissToast,
    handleDesktopTrashAreaEnter,
    handleDesktopTrashAreaLeave,
    isDesktopTrashButtonVisible,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setUiToast,
    setViewingNote,
    showToast,
    uiToast,
    viewingNote,
  } = useAppChrome();

  const {
    activeCategory,
    activeTag,
    handleCategorySelect,
    searchId,
    setActiveCategory,
    setActiveTag,
    setSearchId,
  } = useNotesFilters({
    normalizeCategoryId,
    setActiveTab,
  });

  const {
    categoryDeleteState,
    closeCategoryDeleteDialog,
    handleCategoryDelete,
    handleCategoryDeletePasswordChange,
    moveToCategoryDeletePasswordStep,
    openCategoryDeleteDialog,
  } = useCategoryDeleteDialog({
    activeCategory,
    connStatus,
    normalizeCategoryId,
    setActiveCategory,
    setCategories,
    setNotes,
    supabaseFuncUrl: SUPABASE_FUNC_URL,
    withApiKeyHeaders,
  });

  const chatAssistant = useChatAssistant({
    connStatus,
    getNoteShortId,
    notes,
    setUiToast,
    supabaseFuncUrl: SUPABASE_FUNC_URL,
    withApiKeyHeaders,
  });

  const mockNotes = useMemo(() => [{
    id: 'DEMO0001',
    short_id: 'DEMO0001',
    title: '欢迎使用 TextFlow.文流',
    content: '### 本地离线模式\n\n后端不可用时会进入本地演示。',
    category_id: '1',
    tags: ['START'],
    created_at: new Date().toISOString(),
  }], []);

  const fetchData = useCallback(async () => {
    setConnection({ status: 'checking', errorMessage: '' });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const [notesRes, categoriesRes] = await Promise.all([
        fetch(`${SUPABASE_FUNC_URL}/notes`, { signal: controller.signal, headers: withApiKeyHeaders() }),
        fetch(`${SUPABASE_FUNC_URL}/categories`, { signal: controller.signal, headers: withApiKeyHeaders() }),
      ]);

      if (!notesRes.ok || !categoriesRes.ok) throw new Error('API 连接受限 (HTTP Error)');

      const notesJson = await notesRes.json();
      const categoriesJson = await categoriesRes.json();
      if (notesJson?.ok === false) throw new Error(notesJson.error || '获取笔记失败');
      if (categoriesJson?.ok === false) throw new Error(categoriesJson.error || '获取分类失败');

      setNotes(getVisibleNotes(normalizeNotes(notesJson.data)));
      setCategories(Array.isArray(categoriesJson.data) ? categoriesJson.data : []);
      setConnection({ status: 'online', errorMessage: '' });
    } catch (err) {
      setConnection({ status: 'offline', errorMessage: String(err.message || err) });
      setNotes(mockNotes);
      setCategories([{ id: '1', name: '系统演示' }]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [mockNotes]);

  const {
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
  } = useNoteEditor({
    activeCategory,
    activeTag,
    categories,
    connStatus,
    createLocalShortId,
    emptyNote: EMPTY_NOTE,
    fetchData,
    notes,
    normalizeCategoryId,
    setActiveTab,
    setCategories,
    setNotes,
    supabaseFuncUrl: SUPABASE_FUNC_URL,
    withApiKeyHeaders,
    withShortId,
  });

  const {
    handlePermanentDeleteTrashedNote,
    handleRefreshTrash,
    handleRestoreTrashedNote,
    handleTrashAccessSubmit,
    isTrashLoading,
    openTrashTab,
    setTrashAccessState,
    trashAccessState,
    trashPendingNoteId,
    trashedNotes,
  } = useTrashManager({
    activeTab,
    fetchData,
    normalizeNotes,
    setActiveTab,
    setNotes,
    setViewingNote,
    showToast,
    supabaseFuncUrl: SUPABASE_FUNC_URL,
    withApiKeyHeaders,
  });

  useEffect(() => { fetchData(); }, [fetchData]);

  const requestDeleteNote = (id) => {
    if (!id) return;
    if (!window.confirm('确定将这条笔记移入回收站吗？')) return;
    if (!window.confirm('移入回收站后，普通访客将无法访问它，确认继续吗？')) return;
    handleDelete(id);
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (connStatus === 'offline') {
      showToast('离线模式下不能删除，请先恢复后端连接。');
      return;
    }
    try {
      const response = await fetch(`${SUPABASE_FUNC_URL}/notes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: withApiKeyHeaders(),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || `删除失败 (HTTP ${response.status})`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setViewingNote((prev) => (prev?.id === id ? null : prev));
      showToast('已移入回收站', 'success');
    } catch (err) {
      window.alert(String(err.message || err));
    }
  };

  const allTags = useMemo(() => Array.from(new Set((notes || []).flatMap((n) => (Array.isArray(n?.tags) ? n.tags : [])))), [notes]);
  const noteCountByCategory = useMemo(() => {
    const counter = new Map();
    (notes || []).forEach((note) => {
      const key = normalizeCategoryId(note?.category_id);
      if (!key) return;
      counter.set(key, (counter.get(key) || 0) + 1);
    });
    return counter;
  }, [notes]);
  const activeCategoryName = useMemo(() => {
    const key = normalizeCategoryId(activeCategory);
    if (!key) return '';
    const matched = (categories || []).find((category) => normalizeCategoryId(category?.id) === key);
    return matched?.name || '';
  }, [categories, activeCategory]);
  const filteredNotes = useMemo(() => {
    const keyword = searchId.trim().toLowerCase();
    const currentCategory = normalizeCategoryId(activeCategory);
    return (notes || []).filter((n) => {
      const mCat = currentCategory ? normalizeCategoryId(n.category_id) === currentCategory : true;
      const mTag = activeTag ? n.tags?.includes(activeTag) : true;
      const shortId = getNoteShortId(n).toLowerCase();
      const fullId = String(n.id || '').toLowerCase();
      const mSearch = keyword ? shortId.includes(keyword) || fullId.includes(keyword) : true;
      return mCat && mTag && mSearch;
    });
  }, [notes, activeCategory, activeTag, searchId]);

  return (
    <div className="tf-root flex h-[100dvh] bg-[#F8FAFC] text-slate-900 overflow-hidden">
      <AppOverlays closeMobileSidebar={closeMobileSidebar} connErrorMessage={connErrorMessage} connStatus={connStatus} dismissToast={dismissToast} fetchData={fetchData} isMobileSidebarOpen={isMobileSidebarOpen} uiToast={uiToast} />

      <AppSidebar
        activeCategory={activeCategory}
        activeTab={activeTab}
        appVersionLabel={APP_VERSION_LABEL}
        categories={categories}
        handleCategorySelect={handleCategorySelect}
        handleDesktopTrashAreaEnter={handleDesktopTrashAreaEnter}
        handleDesktopTrashAreaLeave={handleDesktopTrashAreaLeave}
        isDesktopTrashButtonVisible={isDesktopTrashButtonVisible}
        isMobileSidebarOpen={isMobileSidebarOpen}
        normalizeCategoryId={normalizeCategoryId}
        noteCountByCategory={noteCountByCategory}
        onCloseMobileSidebar={closeMobileSidebar}
        onOpenCategoryDeleteDialog={openCategoryDeleteDialog}
        onOpenGuide={() => {
          setActiveTab('guide');
          closeMobileSidebar();
        }}
        onOpenTrash={() => {
          openTrashTab();
          closeMobileSidebar();
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <AppHeader activeTab={activeTab} onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} onOpenNewNoteModal={openNewNoteModal} searchId={searchId} setActiveTab={setActiveTab} setSearchId={setSearchId} />

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'notes' ? (
            <NotesTab
              MarkdownLink={MarkdownLink}
              activeCategory={activeCategory}
              activeCategoryName={activeCategoryName}
              activeTag={activeTag}
              allTags={allTags}
              categories={categories}
              copiedToken={copiedToken}
              copyText={copyText}
              filteredNotes={filteredNotes}
              getNoteShortId={getNoteShortId}
              handleCategorySelect={handleCategorySelect}
              markdownPlugins={MARKDOWN_PLUGINS}
              normalizeCategoryId={normalizeCategoryId}
              onEditNote={openEditNoteModal}
              onViewNote={setViewingNote}
              requestDeleteNote={requestDeleteNote}
              setActiveTag={setActiveTag}
              toDisplayMarkdown={toDisplayMarkdown}
            />
          ) : activeTab === 'chat' ? (
            <Suspense fallback={<LazyTabFallback label="AI文字助手" />}>
              <ChatAssistantTab
                MarkdownLink={MarkdownLink}
                copiedToken={copiedToken}
                copyText={copyText}
                toDisplayMarkdown={toDisplayMarkdown}
                {...chatAssistant}
              />
            </Suspense>
          ) : activeTab === 'roomchat' ? (
            <Suspense fallback={<LazyTabFallback label="流式聊天" />}>
              <EmbeddedChatRoomTab />
            </Suspense>
          ) : activeTab === 'trash' ? (
            <Suspense fallback={<LazyTabFallback label="回收站" />}>
              <TrashTab
                formatDateTime={formatDateTime}
                getNoteShortId={getNoteShortId}
                handlePermanentDeleteTrashedNote={handlePermanentDeleteTrashedNote}
                handleRefreshTrash={handleRefreshTrash}
                handleRestoreTrashedNote={handleRestoreTrashedNote}
                handleTrashAccessSubmit={handleTrashAccessSubmit}
                isTrashLoading={isTrashLoading}
                setActiveTab={setActiveTab}
                setTrashAccessState={setTrashAccessState}
                trashAccessState={trashAccessState}
                trashPendingNoteId={trashPendingNoteId}
                trashedNotes={trashedNotes}
              />
            </Suspense>
          ) : (
            <GuideTab sections={GUIDE_SECTIONS} />
          )}
        </div>
        {activeTab !== 'chat' && activeTab !== 'roomchat' && (
          <footer className="shrink-0 px-4 pt-3 pb-4 text-center text-[11px] leading-5 text-slate-400">
            <p>Copyright © 2011-2026 WithMedia Co.Ltd all rights reserved</p>
            <p>内部使用 请勿外传</p>
          </footer>
        )}
      </div>

      {viewingNote && (
        <NotePreviewModal
          MarkdownLink={MarkdownLink}
          copiedToken={copiedToken}
          copyText={copyText}
          getNoteExternalFetchUrl={getNoteExternalFetchUrl}
          getNoteShortId={getNoteShortId}
          markdownPlugins={MARKDOWN_PLUGINS}
          note={viewingNote}
          onClose={() => setViewingNote(null)}
          onEdit={(note) => { setViewingNote(null); openEditNoteModal(note); }}
          toDisplayMarkdown={toDisplayMarkdown}
        />
      )}

      {isModalOpen && (
        <NoteEditorModal
          categories={categories}
          categoryCreateError={categoryCreateError}
          currentNote={currentNote}
          handleCreateCategory={handleCreateCategory}
          handleNewCategoryNameChange={handleNewCategoryNameChange}
          handleNoteCategorySelect={handleNoteCategorySelect}
          handleNoteContentChange={handleNoteContentChange}
          handleNoteTagsChange={handleNoteTagsChange}
          handleNoteTitleChange={handleNoteTitleChange}
          handleSave={handleSave}
          isAddingCategory={isAddingCategory}
          isCreatingCategory={isCreatingCategory}
          isModalOpen={isModalOpen}
          isSaving={isSaving}
          newCategoryName={newCategoryName}
          newCategoryValue={NEW_CATEGORY_VALUE}
          normalizeCategoryId={normalizeCategoryId}
          onClose={closeNoteModal}
          saveError={saveError}
        />
      )}

      {categoryDeleteState.isOpen && (
        <CategoryDeleteDialog categoryDeleteState={categoryDeleteState} closeCategoryDeleteDialog={closeCategoryDeleteDialog} handleCategoryDelete={handleCategoryDelete} moveToCategoryDeletePasswordStep={moveToCategoryDeletePasswordStep} onPasswordChange={handleCategoryDeletePasswordChange} />
      )}

    </div>
  );
};

export default App;










