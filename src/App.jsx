import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Check,
  Copy,
  LayoutGrid,
  MessageSquare,
  Plus,
  SquarePen,
  Search,
  Send,
  Settings,
  StopCircle,
  Tag,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';

const SUPABASE_FUNC_URL = 'https://bktkvzvylkqvlucoixay.supabase.co/functions/v1/flow-api';
const CHAT_PROVIDERS = ['deepseek', 'gemini', 'chatgpt'];
const CHAT_PROVIDER_LABEL = { deepseek: 'DEEPSEEK', gemini: 'GEMINI', chatgpt: 'CHATGPT' };
const CHAT_MODEL_BY_PROVIDER = { deepseek: 'deepseek-chat', gemini: 'gemini-2.0-flash', chatgpt: 'gpt-4o-mini' };
const EMPTY_NOTE = { id: null, title: '', content: '', category_id: '', tags: [] };
const MAX_CONTEXT_MESSAGES = 12;
const CATEGORY_DELETE_PASSWORD = '5185';
const SHORT_ID_LENGTH = 8;
const NEW_CATEGORY_VALUE = '__new_category__';
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];

const createEmptyHistoryMap = () => ({ deepseek: [], gemini: [], chatgpt: [] });
const createEmptyCategoryDeleteState = () => ({
  isOpen: false,
  category: null,
  step: 1,
  password: '',
  error: '',
  isSubmitting: false,
});
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
const MarkdownLink = ({ href, ...props }) => {
  const safeHref = normalizeHttpUrl(href);
  return (
    <a
      {...props}
      href={safeHref || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.stopPropagation();
        if (!safeHref) e.preventDefault();
      }}
      className="text-blue-600 underline underline-offset-2 break-all hover:text-blue-700"
    />
  );
};

const toContextMessages = (history) =>
  (history || [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .filter((item) => typeof item.content === 'string' && item.content.trim())
    .map((item) => ({ role: item.role, content: item.content.trim() }));

const buildPromptWithContext = (prompt, contextMessages) => {
  const context = (contextMessages || []).slice(-MAX_CONTEXT_MESSAGES);
  if (context.length === 0) return prompt;

  const transcript = context
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
    .join('\n\n');

  return [
    '下面是同一模型会话中的历史上下文，请基于上下文继续回答。',
    '',
    transcript,
    '',
    `用户: ${prompt}`,
    '助手:',
  ].join('\n');
};

const tryParseJson = (v) => { try { return JSON.parse(v); } catch { return null; } };
const extractErrorMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const msg = extractErrorMessage(item);
      if (msg) return msg;
    }
    return '';
  }
  return payload.error?.message || payload.error || payload.message || '';
};

const parseSseEventText = (eventPayload) => {
  if (!eventPayload || eventPayload === '[DONE]') return '';
  const parsed = tryParseJson(eventPayload);
  if (!parsed) return eventPayload;
  const delta = parsed?.choices?.[0]?.delta?.content;
  if (typeof delta === 'string') return delta;
  const message = parsed?.choices?.[0]?.message?.content;
  if (typeof message === 'string') return message;
  const direct = parsed?.text ?? parsed?.content ?? parsed?.message;
  return typeof direct === 'string' ? direct : '';
};

const consumeSseBuffer = (rawBuffer, onText) => {
  let buffer = rawBuffer.replace(/\r\n/g, '\n');
  while (true) {
    const eventEnd = buffer.indexOf('\n\n');
    if (eventEnd === -1) break;
    const rawEvent = buffer.slice(0, eventEnd);
    buffer = buffer.slice(eventEnd + 2);
    const lines = rawEvent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());
    if (lines.length === 0) continue;
    const text = parseSseEventText(lines.join('\n'));
    if (text) onText(text);
  }
  return buffer;
};

const normalizeChatError = (message, provider) => {
  const msg = String(message || '请求失败');
  if (provider === 'gemini' && /models\/.+ is not found/i.test(msg)) {
    return 'Gemini 模型不可用。前端已切换为 gemini-2.0-flash；若仍报错，请更新 Supabase Edge Function 的 Gemini 模型路由。';
  }
  if (provider === 'gemini' && /Incorrect API key provided:\s*AIza/i.test(msg)) {
    return 'Gemini 请求被错误转发到了 OpenAI。请在 Supabase Edge Function 中将 gemini 路由到 Google 接口并使用 GEMINI_API_KEY。';
  }
  return msg;
};

const useChatStream = (baseUrl) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const sendMessage = async ({ prompt, provider, contextMessages = [], onChunk }) => {
    setError(null);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    let collected = '';
    try {
      const composedPrompt = buildPromptWithContext(prompt, contextMessages);
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: composedPrompt,
          provider,
          model: CHAT_MODEL_BY_PROVIDER[provider],
          messages: [...contextMessages, { role: 'user', content: prompt }],
        }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        let errorMessage = '';
        if (contentType.includes('application/json')) {
          const errJson = await response.json().catch(() => null);
          errorMessage = extractErrorMessage(errJson);
        }
        if (!errorMessage) {
          const errText = await response.text().catch(() => '');
          errorMessage = extractErrorMessage(tryParseJson(errText)) || errText;
        }
        throw new Error(errorMessage || `HTTP ${response.status}`);
      }

      if (contentType.includes('application/json')) {
        const json = await response.json().catch(() => ({}));
        if (json?.ok === false) throw new Error(extractErrorMessage(json) || '模型服务异常');
        const text = json?.data?.text ?? json?.data ?? json?.text ?? json?.content;
        if (typeof text === 'string') {
          collected += text;
          onChunk?.(text);
        }
        return collected;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let looksLikeSse = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const decoded = decoder.decode(value, { stream: true });
        sseBuffer += decoded;

        if (!looksLikeSse && sseBuffer.includes('data:')) looksLikeSse = true;

        if (looksLikeSse) {
          sseBuffer = consumeSseBuffer(sseBuffer, (text) => {
            collected += text;
            onChunk?.(text);
          });
        } else {
          collected += decoded;
          onChunk?.(decoded);
          sseBuffer = '';
        }
      }

      const tail = decoder.decode();
      if (tail) sseBuffer += tail;

      if (looksLikeSse && sseBuffer.trim()) {
        consumeSseBuffer(`${sseBuffer}\n\n`, (text) => {
          collected += text;
          onChunk?.(text);
        });
      } else if (!looksLikeSse && sseBuffer) {
        collected += sseBuffer;
        onChunk?.(sseBuffer);
      }

      return collected;
    } catch (err) {
      if (err.name !== 'AbortError') {
        const normalized = normalizeChatError(err.message || err, provider);
        setError(normalized);
        throw new Error(normalized);
      }
      return collected;
    } finally {
      setIsStreaming(false);
    }
  };

  return { sendMessage, stopStreaming: () => abortControllerRef.current?.abort(), isStreaming, error };
};

const App = () => {
  const [activeTab, setActiveTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [searchId, setSearchId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);
  const [chatProvider, setChatProvider] = useState('deepseek');
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatHistoryByProvider, setChatHistoryByProvider] = useState(() => createEmptyHistoryMap());
  const [providerSwitchTip, setProviderSwitchTip] = useState('');
  const [copiedToken, setCopiedToken] = useState(null);
  const [categoryDeleteState, setCategoryDeleteState] = useState(() => createEmptyCategoryDeleteState());
  const [connStatus, setConnStatus] = useState('checking');
  const [connErrorMessage, setConnErrorMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryCreateError, setCategoryCreateError] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [currentNote, setCurrentNote] = useState(EMPTY_NOTE);
  const chatScrollRef = useRef(null);

  const { sendMessage, stopStreaming, isStreaming, error: chatError } = useChatStream(SUPABASE_FUNC_URL);
  const currentChatHistory = useMemo(
    () => chatHistoryByProvider[chatProvider] || [],
    [chatHistoryByProvider, chatProvider],
  );

  const mockNotes = useMemo(() => [{
    id: 'DEMO0001',
    short_id: 'DEMO0001',
    title: '欢迎使用 TextFlow',
    content: '### 本地离线模式\n\n后端不可用时会进入本地演示。',
    category_id: '1',
    tags: ['START'],
    created_at: new Date().toISOString(),
  }], []);

  const fetchData = useCallback(async () => {
    setConnStatus('checking');
    setConnErrorMessage('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const [notesRes, categoriesRes] = await Promise.all([
        fetch(`${SUPABASE_FUNC_URL}/notes`, { signal: controller.signal }),
        fetch(`${SUPABASE_FUNC_URL}/categories`, { signal: controller.signal }),
      ]);
      clearTimeout(timeoutId);

      if (!notesRes.ok || !categoriesRes.ok) throw new Error('API 连接受限 (HTTP Error)');

      const notesJson = await notesRes.json();
      const categoriesJson = await categoriesRes.json();
      if (notesJson?.ok === false) throw new Error(notesJson.error || '获取笔记失败');
      if (categoriesJson?.ok === false) throw new Error(categoriesJson.error || '获取分类失败');

      setNotes(normalizeNotes(notesJson.data));
      setCategories(Array.isArray(categoriesJson.data) ? categoriesJson.data : []);
      setConnStatus('online');
    } catch (err) {
      setConnStatus('offline');
      setConnErrorMessage(String(err.message || err));
      setNotes(mockNotes);
      setCategories([{ id: '1', name: '系统演示' }]);
    }
  }, [mockNotes]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [currentChatHistory, isStreaming]);

  useEffect(() => {
    if (!providerSwitchTip) return undefined;
    const timer = window.setTimeout(() => setProviderSwitchTip(''), 2400);
    return () => window.clearTimeout(timer);
  }, [providerSwitchTip]);

  const handleCategorySelect = useCallback((categoryId) => {
    setActiveTab('notes');
    setActiveTag(null);
    setActiveCategory(categoryId ? normalizeCategoryId(categoryId) : null);
  }, []);

  const copyText = async (text, token) => {
    const content = String(text || '');
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((prev) => (prev === token ? null : prev)), 1200);
    } catch {
      window.alert('复制失败，请手动复制');
    }
  };

  const closeCategoryDeleteDialog = () => setCategoryDeleteState(createEmptyCategoryDeleteState());
  const openCategoryDeleteDialog = (category) => {
    if (!category?.id) return;
    setCategoryDeleteState({
      isOpen: true,
      category,
      step: 1,
      password: '',
      error: '',
      isSubmitting: false,
    });
  };
  const moveToCategoryDeletePasswordStep = () => {
    setCategoryDeleteState((prev) => ({ ...prev, step: 2, error: '' }));
  };
  const handleCategoryDelete = async () => {
    const target = categoryDeleteState.category;
    if (!target?.id || categoryDeleteState.isSubmitting) return;
    const targetCategoryId = normalizeCategoryId(target.id);

    if (categoryDeleteState.password !== CATEGORY_DELETE_PASSWORD) {
      setCategoryDeleteState((prev) => ({ ...prev, error: '删除密码错误，请重新输入。' }));
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

      const response = await fetch(`${SUPABASE_FUNC_URL}/categories/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: categoryDeleteState.password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `删除分类失败 (HTTP ${response.status})`);
      }

      setCategories((prev) => prev.filter((item) => item.id !== target.id));
      setNotes((prev) => prev.map((note) => (normalizeCategoryId(note.category_id) === targetCategoryId ? { ...note, category_id: null } : note)));
      if (normalizeCategoryId(activeCategory) === targetCategoryId) setActiveCategory(null);
      closeCategoryDeleteDialog();
    } catch (err) {
      setCategoryDeleteState((prev) => ({ ...prev, isSubmitting: false, error: String(err.message || err) }));
    }
  };

  const handleCreateCategory = async () => {
    const name = String(newCategoryName || '').trim();
    if (!name) {
      setCategoryCreateError('请输入分类名称。');
      return;
    }

    const exists = (categories || []).some((item) => String(item?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setCategoryCreateError('分类已存在，请使用其他名称。');
      return;
    }

    setCategoryCreateError('');
    setIsCreatingCategory(true);
    try {
      if (connStatus === 'offline') {
        const localCategory = { id: `local-cat-${Date.now()}`, name };
        setCategories((prev) => [...prev, localCategory]);
        setCurrentNote((prev) => ({ ...prev, category_id: normalizeCategoryId(localCategory.id) }));
        setIsAddingCategory(false);
        setNewCategoryName('');
        return;
      }

      const response = await fetch(`${SUPABASE_FUNC_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.error || `新增分类失败 (HTTP ${response.status})`);
      }

      const created = result?.data;
      if (!created?.id) throw new Error('新增分类失败：未返回分类ID。');
      setCategories((prev) => [...prev, created]);
      setCurrentNote((prev) => ({ ...prev, category_id: normalizeCategoryId(created.id) }));
      setIsAddingCategory(false);
      setNewCategoryName('');
    } catch (err) {
      setCategoryCreateError(String(err.message || err));
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleProviderChange = (nextProvider) => {
    if (nextProvider === chatProvider) return;

    const wasStreaming = isStreaming;
    if (wasStreaming) stopStreaming();

    const nextHistory = chatHistoryByProvider[nextProvider] || [];
    const roundCount = nextHistory.filter((m) => m.role === 'user').length;
    const baseTip = roundCount > 0
      ? `已切换到 ${CHAT_PROVIDER_LABEL[nextProvider]}，将继续该模型的上下文（${roundCount} 轮）。`
      : `已切换到 ${CHAT_PROVIDER_LABEL[nextProvider]}，该模型暂无上下文，将开始新对话。`;

    setChatProvider(nextProvider);
    setProviderSwitchTip(wasStreaming ? `${baseTip} 已停止上一模型生成。` : baseTip);
  };

  const openNewNoteModal = () => {
    setActiveTab('notes');
    setSaveError('');
    setCategoryCreateError('');
    setNewCategoryName('');
    setIsAddingCategory(false);
    setCurrentNote({ ...EMPTY_NOTE, category_id: normalizeCategoryId(activeCategory) || '', tags: activeTag ? [activeTag] : [] });
    setIsModalOpen(true);
  };

  const openEditNoteModal = (note) => {
    setSaveError('');
    setCategoryCreateError('');
    setNewCategoryName('');
    setIsAddingCategory(false);
    setCurrentNote({
      id: note?.id || null,
      title: note?.title || '',
      content: note?.content || '',
      category_id: normalizeCategoryId(note?.category_id) || '',
      tags: Array.isArray(note?.tags) ? note.tags : [],
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...currentNote,
      title: String(currentNote.title || '').trim(),
      content: String(currentNote.content || '').trim(),
      category_id: currentNote.category_id || null,
      tags: Array.isArray(currentNote.tags) ? currentNote.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    };

    if (!payload.title && !payload.content) {
      setSaveError('请至少填写标题或内容。');
      return;
    }

    setSaveError('');
    setIsSaving(true);
    try {
      if (connStatus === 'offline') {
        const existingIds = new Set((notes || []).map((note) => String(note?.id || '')));
        let localId = payload.id || createLocalShortId();
        if (!payload.id) {
          while (existingIds.has(localId)) localId = createLocalShortId();
        }
        const localNote = withShortId({ ...payload, id: localId, created_at: new Date().toISOString() });
        setNotes((prev) => payload.id ? prev.map((n) => (n.id === payload.id ? localNote : n)) : [localNote, ...prev]);
        setIsModalOpen(false);
        return;
      }

      const response = await fetch(`${SUPABASE_FUNC_URL}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || `保存失败 (HTTP ${response.status})`);

      const savedNote = withShortId(result?.data);
      if (savedNote?.id) {
        setNotes((prev) => {
          const exists = prev.some((n) => n.id === savedNote.id);
          return exists ? prev.map((n) => (n.id === savedNote.id ? savedNote : n)) : [savedNote, ...prev];
        });
      } else {
        await fetchData();
      }
      setIsModalOpen(false);
    } catch (err) {
      setSaveError(String(err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteNote = (id) => {
    if (!id) return;
    if (!window.confirm('确定删除这条笔记吗？')) return;
    if (!window.confirm('删除后不可恢复，确认继续删除吗？')) return;
    handleDelete(id);
  };

  const handleDelete = async (id) => {
    if (!id) return;
    if (connStatus === 'offline') {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return;
    }
    try {
      const response = await fetch(`${SUPABASE_FUNC_URL}/notes/${id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || `删除失败 (HTTP ${response.status})`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      window.alert(String(err.message || err));
    }
  };

  const onChat = async () => {
    const prompt = chatPrompt.trim();
    if (!prompt || isStreaming) return;

    const providerAtSend = chatProvider;
    const historyForProvider = chatHistoryByProvider[providerAtSend] || [];
    const contextMessages = toContextMessages(historyForProvider).slice(-MAX_CONTEXT_MESSAGES);
    const now = Date.now();
    const userId = `u-${providerAtSend}-${now}`;
    const assistantId = `a-${providerAtSend}-${now}`;

    setChatPrompt('');
    setChatHistoryByProvider((prev) => ({
      ...prev,
      [providerAtSend]: [
        ...(prev[providerAtSend] || []),
        { id: userId, role: 'user', content: prompt, provider: providerAtSend, createdAt: now },
        { id: assistantId, role: 'assistant', content: '', provider: providerAtSend, createdAt: now + 1 },
      ],
    }));

    try {
      await sendMessage({
        prompt,
        provider: providerAtSend,
        contextMessages,
        onChunk: (chunk) => {
          setChatHistoryByProvider((prev) => ({
            ...prev,
            [providerAtSend]: (prev[providerAtSend] || []).map((item) =>
              item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item,
            ),
          }));
        },
      });
    } catch (err) {
      setChatHistoryByProvider((prev) => ({
        ...prev,
        [providerAtSend]: (prev[providerAtSend] || []).map((item) =>
          item.id === assistantId && !item.content
            ? { ...item, content: `请求失败: ${String(err.message || err)}` }
            : item,
        ),
      }));
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
    <div className="tf-root flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden">
      {connStatus === 'offline' && (
        <div className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white text-[10px] font-bold py-2 px-6 flex justify-between items-center shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-2"><WifiOff size={14} /> 后端连接异常: {String(connErrorMessage)}</div>
          <button onClick={fetchData} className="bg-white/20 px-3 py-1 rounded-full text-[10px] hover:bg-white/30">尝试重连</button>
        </div>
      )}

      <aside className="tf-sidebar w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200"><span className="text-white font-bold text-xl">T</span></div>
            <h1 className="text-2xl font-black tracking-tighter">TextFlow</h1>
          </div>
          <nav className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
            <button onClick={() => handleCategorySelect(null)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${!activeCategory ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={18} /> 全部内容</button>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4 ml-4">分类空间</p>
            {Array.isArray(categories) && categories.map((cat) => {
              const categoryKey = normalizeCategoryId(cat?.id);
              const isActive = normalizeCategoryId(activeCategory) === categoryKey;
              const count = noteCountByCategory.get(categoryKey) || 0;
              return (
                <div key={cat.id} className={`group flex items-center justify-between px-4 py-2.5 rounded-xl ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <button type="button" onClick={() => handleCategorySelect(categoryKey)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                    <span className="truncate">{cat.name}</span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openCategoryDeleteDialog(cat)}
                    className="ml-2 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除分类"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-50 text-slate-300 text-[10px] font-bold flex items-center gap-2"><Settings size={12} /> V1.0.8 STABLE</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <header className="bg-white px-8 pt-5 flex items-end gap-1 shrink-0 z-10">
          <button onClick={() => setActiveTab('notes')} className={`px-8 py-4 rounded-t-2xl text-sm font-black ${activeTab === 'notes' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>笔记流</button>
          <button onClick={() => setActiveTab('chat')} className={`px-8 py-4 rounded-t-2xl text-sm font-black ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>AI 助手</button>
          <div className="ml-auto mb-4 flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input type="text" placeholder="搜索短ID / 全ID..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-full text-xs w-56 focus:outline-none focus:bg-white border border-transparent focus:border-blue-100" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
            </div>
            <button onClick={openNewNoteModal} className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700"><Plus size={24} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'notes' ? (
            <div className="h-full flex flex-col">
              <div className="px-8 py-4 flex items-center gap-2 overflow-x-auto no-scrollbar bg-white/50">
                <Tag size={14} className="text-slate-400 shrink-0" />
                <button onClick={() => setActiveTag(null)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold border ${!activeTag ? 'bg-slate-900 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500'}`}>全部标签</button>
                {allTags.map((tag) => (
                  <button key={tag} onClick={() => setActiveTag(tag)} className={`px-4 py-1.5 rounded-full text-[11px] font-bold border ${activeTag === tag ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>#{tag}</button>
                ))}
              </div>

              {activeCategoryName && (
                <div className="px-8 py-3 bg-blue-50/60 text-xs font-semibold text-blue-700">
                  当前分类: {activeCategoryName} ({filteredNotes.length} 条)
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {filteredNotes.length === 0 ? (
                  <div className="h-full grid place-items-center text-slate-400 text-sm font-bold">暂无匹配笔记</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredNotes.map((note) => {
                      const shortId = getNoteShortId(note);
                      const noteTextToken = `note-text-${note.id}`;
                      const noteIdToken = `note-id-${note.id}`;
                      const isTextCopied = copiedToken === noteTextToken;
                      const isIdCopied = copiedToken === noteIdToken;
                      return (
                        <div key={note.id} onClick={() => setViewingNote(note)} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm hover:shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col min-h-[300px]">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {shortId || '-'}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyText(shortId, noteIdToken); }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                              >
                                <Copy size={12} />
                                {isIdCopied ? '已复制' : '复制'}
                              </button>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditNoteModal(note); }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200"
                            >
                              <SquarePen size={12} />
                              编辑
                            </button>
                          </div>

                          <h3 className="text-xl font-black text-slate-800 mb-3 truncate">{String(note.title || '无标题')}</h3>
                          <div className="tf-markdown prose prose-sm prose-slate prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 text-slate-600 line-clamp-6 mb-4 font-medium">
                            <ReactMarkdown
                              remarkPlugins={MARKDOWN_PLUGINS}
                              components={{ a: MarkdownLink }}
                            >
                              {String(note.content || '')}
                            </ReactMarkdown>
                          </div>

                          <div className="mt-auto pt-5 border-t border-slate-50 flex items-center justify-between">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyText(note.content, noteTextToken); }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                            >
                              {isTextCopied ? '已复制文本' : '复制文本'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); requestDeleteNote(note.id); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col bg-white">
              <div className="px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><MessageSquare size={20} /></div><h2 className="font-black text-lg">Ai文字助手</h2></div>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  {CHAT_PROVIDERS.map((provider) => (
                    <button key={provider} onClick={() => handleProviderChange(provider)} className={`px-4 py-2 rounded-lg text-[10px] font-black ${chatProvider === provider ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>{CHAT_PROVIDER_LABEL[provider]}</button>
                  ))}
                </div>
              </div>

              {providerSwitchTip && (
                <div className="px-8 py-2 bg-amber-50 text-amber-700 text-xs font-bold">
                  {providerSwitchTip}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-12 bg-slate-50/30" ref={chatScrollRef}>
                <div className="max-w-4xl mx-auto space-y-6">
                  {chatError && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2"><AlertCircle size={16} /> {chatError}</div>}
                  {currentChatHistory.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-200 opacity-40"><MessageSquare size={64} /><p className="font-black mt-4 uppercase tracking-widest text-xs">开始连续对话（刷新后清空）</p></div>
                  ) : (
                    <div className="space-y-4">
                      {currentChatHistory.map((item) => {
                        const isUser = item.role === 'user';
                        const copied = copiedToken === item.id;
                        return (
                          <div key={item.id} className={`rounded-2xl border p-5 shadow-sm ${isUser ? 'bg-blue-50 border-blue-200 ml-8' : 'bg-white border-slate-200 mr-8'}`}>
                            <div className="flex items-center justify-between mb-3">
                              <span className={`text-xs font-black tracking-wide ${isUser ? 'text-blue-700' : 'text-slate-500'}`}>{isUser ? '你' : `AI · ${CHAT_PROVIDER_LABEL[item.provider] || item.provider}`}</span>
                              <button onClick={() => copyText(item.content, item.id)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : '复制'}</button>
                            </div>
                            <div className="tf-markdown prose prose-slate prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 max-w-none text-sm leading-7">
                              <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={{ a: MarkdownLink }}>
                                {item.content || (isStreaming && !isUser ? '...' : '')}
                              </ReactMarkdown>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-white">
                <div className="max-w-4xl mx-auto relative group">
                  <textarea rows="2" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 resize-none font-medium" placeholder={`向 ${CHAT_PROVIDER_LABEL[chatProvider]} 提问...`} value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onChat(); } }} />
                  <div className="absolute bottom-4 right-4">{isStreaming ? <button onClick={stopStreaming} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"><StopCircle size={20} /></button> : <button onClick={onChat} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Send size={20} /></button>}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewingNote && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-8 md:px-10 py-6 md:py-8 bg-white flex justify-between items-center gap-4">
              <div className="min-w-0">
                <h3 className="text-xl md:text-2xl font-black truncate">{String(viewingNote.title || '正文')}</h3>
                <p className="text-xs font-semibold text-slate-400 mt-2 font-mono">短ID: {getNoteShortId(viewingNote) || '-'}</p>
              </div>
              <button onClick={() => setViewingNote(null)} className="p-2 border rounded-full hover:bg-slate-50 shrink-0"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/70">
              <article className="max-w-3xl mx-auto px-6 md:px-10 py-8 md:py-10">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-6 md:px-8 py-6 md:py-8">
                  <div className="tf-markdown prose prose-slate prose-lg prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 max-w-none leading-8">
                    <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={{ a: MarkdownLink }}>
                      {String(viewingNote.content || '')}
                    </ReactMarkdown>
                  </div>
                </div>
              </article>
            </div>
            <div className="p-8 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
              <span className="text-xs font-bold text-slate-400 font-mono">短ID: {getNoteShortId(viewingNote) || '-'}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => copyText(viewingNote.content, `view-note-text-${viewingNote.id}`)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
                >
                  {copiedToken === `view-note-text-${viewingNote.id}` ? '已复制正文' : '复制正文'}
                </button>
                <button
                  onClick={() => copyText(getNoteShortId(viewingNote), `view-note-id-${viewingNote.id}`)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
                >
                  {copiedToken === `view-note-id-${viewingNote.id}` ? '已复制ID' : '复制ID'}
                </button>
                <button
                  onClick={() => copyText(getNoteExternalFetchUrl(viewingNote), `view-note-link-${viewingNote.id}`)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:border-slate-300"
                >
                  {copiedToken === `view-note-link-${viewingNote.id}` ? '已复制调取链接' : '复制调取链接'}
                </button>
                <button onClick={() => { setViewingNote(null); openEditNoteModal(viewingNote); }} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold">编辑内容</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black">{currentNote.id ? '编辑内容' : '新建内容'}</h3>
              <button onClick={() => { setSaveError(''); setCategoryCreateError(''); setIsAddingCategory(false); setNewCategoryName(''); setIsModalOpen(false); }} className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <input type="text" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="标题..." value={currentNote.title} onChange={(e) => setCurrentNote({ ...currentNote, title: e.target.value })} />
              <textarea rows="8" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none resize-none" placeholder="Markdown 内容..." value={currentNote.content} onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <select
                  className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100"
                  value={isAddingCategory ? NEW_CATEGORY_VALUE : (currentNote.category_id || '')}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue === NEW_CATEGORY_VALUE) {
                      setIsAddingCategory(true);
                      setCategoryCreateError('');
                      setCurrentNote((prev) => ({ ...prev, category_id: '' }));
                      return;
                    }
                    setIsAddingCategory(false);
                    setCategoryCreateError('');
                    setCurrentNote({ ...currentNote, category_id: normalizeCategoryId(nextValue) });
                  }}
                >
                  <option value="">未分类</option>
                  {categories.map((c) => <option key={c.id} value={normalizeCategoryId(c.id)}>{c.name}</option>)}
                  <option value={NEW_CATEGORY_VALUE}>+ 新增分类...</option>
                </select>
                <input type="text" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100" placeholder="标签 (逗号分隔)..." value={currentNote.tags?.join(', ')} onChange={(e) => setCurrentNote({ ...currentNote, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
              </div>
              {isAddingCategory && (
                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      className="flex-1 p-3 bg-white rounded-xl border border-blue-100 outline-none"
                      placeholder="输入新分类名称..."
                      value={newCategoryName}
                      onChange={(e) => { setNewCategoryName(e.target.value); setCategoryCreateError(''); }}
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
            <div className="p-8 border-t flex justify-end gap-4 bg-slate-50/50">
              <button onClick={() => { setSaveError(''); setCategoryCreateError(''); setIsAddingCategory(false); setNewCategoryName(''); setIsModalOpen(false); }} className="px-6 py-2 text-slate-500 font-bold">放弃</button>
              <button onClick={handleSave} disabled={isSaving} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-60">{isSaving ? '保存中...' : '同步更改'}</button>
            </div>
          </div>
        </div>
      )}

      {categoryDeleteState.isOpen && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black text-red-600">删除分类</h3>
              <button onClick={closeCategoryDeleteDialog} className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-5">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                即将删除分类：{categoryDeleteState.category?.name || '未命名分类'}
              </div>
              {categoryDeleteState.step === 1 ? (
                <p className="text-sm font-medium text-slate-600">删除后，该分类下所有文字卡片会自动改为“未分类”，卡片内容不会被删除。</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-600">请输入删除密码完成最后确认。</p>
                  <input
                    type="password"
                    className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none"
                    placeholder="请输入删除密码"
                    value={categoryDeleteState.password}
                    onChange={(e) => setCategoryDeleteState((prev) => ({ ...prev, password: e.target.value, error: '' }))}
                  />
                </div>
              )}
              {categoryDeleteState.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{categoryDeleteState.error}</div>
              )}
            </div>
            <div className="p-8 border-t flex justify-end gap-4 bg-slate-50/50">
              <button onClick={closeCategoryDeleteDialog} className="px-6 py-2 text-slate-500 font-bold">取消</button>
              {categoryDeleteState.step === 1 ? (
                <button onClick={moveToCategoryDeletePasswordStep} className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-200">继续删除</button>
              ) : (
                <button onClick={handleCategoryDelete} disabled={categoryDeleteState.isSubmitting} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 disabled:opacity-60">
                  {categoryDeleteState.isSubmitting ? '删除中...' : '确认删除分类'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .tf-root { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
        .tf-sidebar { height: 100vh; position: sticky; top: 0; flex-shrink: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .prose pre { background: #f1f5f9; padding: 1.25rem; border-radius: 1rem; overflow-x: auto; margin: 1rem 0; border: 1px solid #e2e8f0; }
        .prose code { color: #2563eb; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.875em; }
        .tf-markdown p, .tf-markdown li, .tf-markdown blockquote { white-space: pre-wrap; }
        .tf-markdown { word-break: break-word; }
        .line-clamp-6 { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
        .animate-in { animation: tf-fade-in 0.4s ease-out; }
        @keyframes tf-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      ` }} />
    </div>
  );
};

export default App;
