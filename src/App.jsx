import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  BookOpen,
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
const CHAT_PROVIDER_LABEL = { deepseek: 'DeepSeek-V3.2', gemini: 'Gemini 2.0 flash', chatgpt: 'ChatGPT 5.2 Thinking' };
const CHAT_MODEL_BY_PROVIDER = { deepseek: 'deepseek-reasoner', gemini: 'gemini-2.0-flash', chatgpt: 'gpt-4o-mini' };
const EMPTY_NOTE = { id: null, title: '', content: '', category_id: '', tags: [] };
const MAX_CONTEXT_MESSAGES = 12;
const SHORT_ID_LENGTH = 8;
const NEW_CATEGORY_VALUE = '__new_category__';
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];
const PRE_PROMPT_PREVIEW_LENGTH = 10;
const RELEASE_BASE_VERSION = '1.0.8';
const RELEASE_CHANNEL = 'stable';
const RELEASE_UPDATES = [
  { level: 'minor', label: 'guide-page-and-sidebar-polish' },
];
const GUIDE_SECTIONS = [
  {
    title: '1. 初次使用',
    points: [
      '左侧点击“全部内容”查看所有文字卡片，再按分类或标签快速筛选。',
      '右上角“+”按钮可新建卡片，支持标题、正文、分类与标签。',
      '点击卡片可进入全文页，支持复制正文、复制短ID与复制调取链接。',
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
const toDisplayMarkdown = (value) => String(value || '')
  .replace(/\\r\\n/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n')
  .replace(/\n/g, '  \n');
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
      const isSseResponse = /\btext\/event-stream\b/i.test(contentType);

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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const decoded = decoder.decode(value, { stream: true });
        if (isSseResponse) {
          sseBuffer += decoded;
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
      if (isSseResponse) {
        if (tail) sseBuffer += tail;
        if (sseBuffer.trim()) {
          consumeSseBuffer(`${sseBuffer}\n\n`, (text) => {
            collected += text;
            onChunk?.(text);
          });
        }
      } else if (tail) {
        collected += tail;
        onChunk?.(tail);
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
  const [prePromptIdInput, setPrePromptIdInput] = useState('');
  const [prePromptReference, setPrePromptReference] = useState(null);
  const [prePromptUsageStats, setPrePromptUsageStats] = useState({});
  const [isPrePromptLoading, setIsPrePromptLoading] = useState(false);
  const [uiToast, setUiToast] = useState(null);
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
  const topPrePromptStats = useMemo(
    () => Object.values(prePromptUsageStats || {})
      .sort((a, b) => (b.count || 0) - (a.count || 0) || (b.lastFetchedAt || 0) - (a.lastFetchedAt || 0))
      .slice(0, 8),
    [prePromptUsageStats],
  );

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
    setConnStatus('checking');
    setConnErrorMessage('');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const [notesRes, categoriesRes] = await Promise.all([
        fetch(`${SUPABASE_FUNC_URL}/notes`, { signal: controller.signal }),
        fetch(`${SUPABASE_FUNC_URL}/categories`, { signal: controller.signal }),
      ]);

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
    } finally {
      window.clearTimeout(timeoutId);
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

  useEffect(() => {
    if (!uiToast) return undefined;
    const timer = window.setTimeout(() => {
      setUiToast((prev) => (prev?.id === uiToast.id ? null : prev));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [uiToast]);

  const handleCategorySelect = useCallback((categoryId) => {
    setActiveTab('notes');
    setActiveTag(null);
    setActiveCategory(categoryId ? normalizeCategoryId(categoryId) : null);
  }, []);

  const copyText = async (text, token) => {
    const content = String(text || '');
    if (!content) return;

    const fallbackCopy = (value) => {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }

      document.body.removeChild(textarea);
      return ok;
    };

    let copied = false;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) copied = fallbackCopy(content);

    if (!copied) {
      window.alert('复制失败，请手动复制');
      return;
    }

    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((prev) => (prev === token ? null : prev)), 1200);
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

      const response = await fetch(`${SUPABASE_FUNC_URL}/categories/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
      const response = await fetch(`${SUPABASE_FUNC_URL}/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok === false) throw new Error(result?.error || `删除失败 (HTTP ${response.status})`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      window.alert(String(err.message || err));
    }
  };

  const showToast = useCallback((message, type = 'error') => {
    const text = String(message || '').trim();
    if (!text) return;
    setUiToast({ id: Date.now(), type, message: text });
  }, []);

  const findNoteByExternalId = useCallback((externalId) => {
    const target = String(externalId || '').trim().toLowerCase();
    if (!target) return null;
    return (notes || []).find((note) => {
      const shortId = getNoteShortId(note).toLowerCase();
      const fullId = String(note?.id || '').trim().toLowerCase();
      return shortId === target || fullId === target;
    }) || null;
  }, [notes]);

  const applyPrePromptReference = useCallback((reference) => {
    if (!reference?.id || !reference?.content) return;
    const normalizedId = toShortId(reference.id) || String(reference.id || '').trim().toUpperCase();
    if (!normalizedId) return;
    const sourceTitle = String(reference.title || `ID ${normalizedId}`).trim() || `ID ${normalizedId}`;
    const titlePreview = sourceTitle.length > PRE_PROMPT_PREVIEW_LENGTH
      ? `${sourceTitle.slice(0, PRE_PROMPT_PREVIEW_LENGTH)}...`
      : sourceTitle;

    setPrePromptIdInput(normalizedId);
    setPrePromptReference({
      id: normalizedId,
      title: sourceTitle,
      titlePreview,
      content: String(reference.content || ''),
    });
  }, []);

  const recordPrePromptUsage = useCallback((reference) => {
    if (!reference?.id || !reference?.content) return;
    const normalizedId = toShortId(reference.id) || String(reference.id || '').trim().toUpperCase();
    const content = String(reference.content || '').trim();
    if (!normalizedId || !content) return;

    const sourceTitle = String(reference.title || `ID ${normalizedId}`).trim() || `ID ${normalizedId}`;
    const titlePreview = sourceTitle.length > PRE_PROMPT_PREVIEW_LENGTH
      ? `${sourceTitle.slice(0, PRE_PROMPT_PREVIEW_LENGTH)}...`
      : sourceTitle;
    const now = Date.now();

    setPrePromptUsageStats((prev) => {
      const current = prev?.[normalizedId];
      return {
        ...(prev || {}),
        [normalizedId]: {
          id: normalizedId,
          title: sourceTitle,
          titlePreview,
          content,
          count: (current?.count || 0) + 1,
          lastFetchedAt: now,
        },
      };
    });
  }, []);

  const clearPrePromptReference = () => {
    setPrePromptReference(null);
    setPrePromptIdInput('');
  };

  const handleFetchPrePrompt = async () => {
    const externalId = String(prePromptIdInput || '').trim();
    if (!externalId || isPrePromptLoading) return;

    setIsPrePromptLoading(true);
    try {
      let title = '';
      let content = '';

      const inMemoryNote = findNoteByExternalId(externalId);
      if (inMemoryNote) {
        title = String(inMemoryNote?.title || '').trim();
        content = String(inMemoryNote?.content || '').trim();
      } else if (connStatus === 'offline') {
        showToast('未找到对应文案，请检查ID');
        return;
      } else {
        const response = await fetch(`${SUPABASE_FUNC_URL}/notes/${encodeURIComponent(externalId)}`);
        const responseContentType = response.headers.get('content-type') || '';
        const isJsonResponse = responseContentType.includes('application/json');
        const payload = isJsonResponse ? await response.json().catch(() => null) : null;
        const plainText = isJsonResponse ? '' : await response.text().catch(() => '');
        const responseError = extractErrorMessage(payload) || plainText;

        if (response.status === 404 || /invalid input syntax for type uuid/i.test(responseError)) {
          showToast('未找到对应文案，请检查ID');
          return;
        }

        if (response.status === 409) {
          showToast(responseError || '短ID不唯一，请使用完整ID查询。');
          return;
        }

        if (!response.ok) throw new Error(responseError || `HTTP ${response.status}`);

        if (isJsonResponse) {
          if (payload?.ok === false) {
            const errorMessage = extractErrorMessage(payload);
            if (/不存在|not found/i.test(errorMessage)) {
              showToast('未找到对应文案，请检查ID');
              return;
            }
            throw new Error(errorMessage || '获取前置信息失败');
          }
          title = String(payload?.data?.title || '').trim();
          content = String(payload?.data?.text ?? payload?.data?.content ?? '').trim();
        } else {
          content = String(plainText || '').trim();
        }
      }

      if (!content) {
        showToast('该ID对应的文案内容为空');
        return;
      }

      if (!title) {
        const fallbackNote = findNoteByExternalId(externalId);
        title = String(fallbackNote?.title || '').trim();
      }

      const normalizedId = toShortId(externalId) || externalId.toUpperCase();
      const sourceTitle = title || `ID ${normalizedId}`;
      const titlePreview = sourceTitle.length > PRE_PROMPT_PREVIEW_LENGTH
        ? `${sourceTitle.slice(0, PRE_PROMPT_PREVIEW_LENGTH)}...`
        : sourceTitle;
      const resolvedReference = {
        id: normalizedId,
        title: sourceTitle,
        titlePreview,
        content,
      };

      applyPrePromptReference(resolvedReference);
      recordPrePromptUsage(resolvedReference);
    } catch {
      showToast('获取前置信息失败');
    } finally {
      setIsPrePromptLoading(false);
    }
  };

  const onChat = async () => {
    const prompt = chatPrompt.trim();
    if (!prompt || isStreaming) return;

    const finalPrompt = prePromptReference?.content
      ? `${prePromptReference.content}\n\n${prompt}`
      : prompt;

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
        prompt: finalPrompt,
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
    <div className="tf-root flex h-[100dvh] bg-[#F8FAFC] text-slate-900 overflow-hidden">
      {connStatus === 'offline' && (
        <div className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white text-[10px] font-bold py-2 px-6 flex justify-between items-center shadow-lg animate-in slide-in-from-top">
          <div className="flex items-center gap-2"><WifiOff size={14} /> 后端连接异常: {String(connErrorMessage)}</div>
          <button onClick={fetchData} className="bg-white/20 px-3 py-1 rounded-full text-[10px] hover:bg-white/30">尝试重连</button>
        </div>
      )}

      {uiToast && (
        <div className={`fixed right-4 top-16 z-[1201] max-w-xs sm:max-w-sm rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${uiToast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <div className="flex items-start gap-2">
            {uiToast.type === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            <p className="text-xs font-semibold leading-5 flex-1">{uiToast.message}</p>
            <button type="button" onClick={() => setUiToast(null)} className="p-0.5 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <aside className="tf-sidebar w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200"><span className="text-white font-bold text-xl">T</span></div>
            <h1 className="inline-flex items-end gap-1 text-2xl font-black tracking-tight leading-none">
              <span className="leading-none">TextFlow.</span>
              <span className="relative -top-[1px] text-[0.8em] leading-none">文流</span>
            </h1>
          </div>
          <nav className="space-y-1 overflow-y-auto flex-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === 'guide' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <BookOpen size={18} /> 使用指南
            </button>
            <button onClick={() => handleCategorySelect(null)} className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 ${activeTab === 'notes' && !activeCategory ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutGrid size={18} /> 全部内容</button>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-10 mb-4 ml-4">分类空间</p>
            {Array.isArray(categories) && categories.map((cat) => {
              const categoryKey = normalizeCategoryId(cat?.id);
              const isActive = activeTab === 'notes' && normalizeCategoryId(activeCategory) === categoryKey;
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
        <div className="mt-auto px-6 pt-8 pb-4 text-slate-300 text-[10px] font-bold flex items-center justify-center gap-2 text-center"><Settings size={12} /> {APP_VERSION_LABEL}</div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        <header className="bg-white px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 shrink-0 z-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex items-end gap-1 overflow-x-auto no-scrollbar">
              <button onClick={() => setActiveTab('notes')} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-t-2xl text-xs sm:text-sm font-black whitespace-nowrap ${activeTab === 'notes' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>文字流</button>
              <button onClick={() => setActiveTab('chat')} className={`px-5 sm:px-8 py-3 sm:py-4 rounded-t-2xl text-xs sm:text-sm font-black whitespace-nowrap ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-slate-50' : 'text-slate-400 hover:text-slate-600'}`}>AI文字助手</button>
            </div>
            <div className="w-full sm:w-auto sm:ml-auto pb-3 sm:pb-4 flex items-center gap-2 sm:gap-4">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input type="text" placeholder="搜索短ID / 全ID..." className="pl-9 pr-4 py-2 bg-slate-100 rounded-full text-xs w-full sm:w-56 focus:outline-none focus:bg-white border border-transparent focus:border-blue-100" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
              </div>
              <button onClick={openNewNoteModal} className="p-2.5 sm:p-3 bg-blue-600 text-white rounded-2xl shadow-xl hover:bg-blue-700 shrink-0"><Plus size={22} /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'notes' ? (
            <div className="h-full flex flex-col">
              <div className="md:hidden px-4 py-3 bg-white/70">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <button type="button" onClick={() => handleCategorySelect(null)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${!activeCategory ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>全部分类</button>
                  {categories.map((cat) => {
                    const categoryKey = normalizeCategoryId(cat?.id);
                    const isActive = activeTab === 'notes' && normalizeCategoryId(activeCategory) === categoryKey;
                    return (
                      <button
                        key={`mobile-${cat.id}`}
                        type="button"
                        onClick={() => handleCategorySelect(categoryKey)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}
                      >
                        {cat.name}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-8">
                    {filteredNotes.map((note) => {
                      const shortId = getNoteShortId(note);
                      const noteTextToken = `note-text-${note.id}`;
                      const noteIdToken = `note-id-${note.id}`;
                      const isTextCopied = copiedToken === noteTextToken;
                      const isIdCopied = copiedToken === noteIdToken;
                      return (
                        <div key={note.id} onClick={() => setViewingNote(note)} className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 border border-slate-200 shadow-sm hover:shadow-xl cursor-pointer hover:-translate-y-1 transition-all flex flex-col min-h-[260px] sm:min-h-[300px]">
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
                              {toDisplayMarkdown(note.content)}
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
          ) : activeTab === 'chat' ? (
            <div className="h-full flex flex-col bg-[#F8FAFC]">
              <div className="px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center"><MessageSquare size={20} /></div><h2 className="font-black text-lg">AI文字助手</h2></div>
                <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                  {CHAT_PROVIDERS.map((provider) => (
                    <button key={provider} onClick={() => handleProviderChange(provider)} className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black whitespace-nowrap flex-none ${chatProvider === provider ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>{CHAT_PROVIDER_LABEL[provider]}</button>
                  ))}
                </div>
              </div>

              {providerSwitchTip && (
                <div className="px-4 sm:px-8 py-2 bg-amber-50 text-amber-700 text-xs font-bold">
                  {providerSwitchTip}
                </div>
              )}

              {topPrePromptStats.length > 0 && (
                <div className="px-4 sm:px-8 pb-2">
                  <div className="max-w-[72rem] w-full mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="px-3 py-1.5 rounded-full text-[11px] font-bold border bg-white border-slate-200 text-slate-500 whitespace-nowrap shrink-0">高频调取</span>
                    {topPrePromptStats.map((item) => (
                      <button
                        key={`prefetch-${item.id}`}
                        type="button"
                        onClick={() => applyPrePromptReference(item)}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold border bg-white border-slate-200 text-slate-600 hover:border-slate-300 whitespace-nowrap shrink-0"
                        title={`${item.id} · ${item.title}`}
                      >
                        <span className="font-mono">{item.id}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="max-w-[8.5rem] truncate">{item.titlePreview}</span>
                        <span className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{item.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={`flex-1 p-4 sm:p-8 lg:p-12 bg-[#F8FAFC] ${currentChatHistory.length === 0 && !chatError ? 'overflow-hidden' : 'overflow-y-auto'}`} ref={chatScrollRef}>
                <div className={`max-w-[72rem] w-full mx-auto ${currentChatHistory.length === 0 && !chatError ? 'h-full flex flex-col' : 'space-y-6'}`}>
                  {chatError && <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2"><AlertCircle size={16} /> {chatError}</div>}
                  {currentChatHistory.length === 0 ? (
                    <div className="flex-1" />
                  ) : (
                    <div className="space-y-4">
                      {currentChatHistory.map((item) => {
                        const isUser = item.role === 'user';
                        const copied = copiedToken === item.id;
                        return (
                          <div key={item.id} className={`w-full rounded-2xl border p-4 sm:p-5 shadow-sm ${isUser ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
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

              <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-5 sm:pb-6 bg-[#F8FAFC]">
                <div className="max-w-[24rem] w-full mx-auto mb-2 sm:mb-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:border-blue-300"
                        placeholder="前置提示词 ID（输入短ID或完整ID）"
                        value={prePromptIdInput}
                        onChange={(e) => setPrePromptIdInput(e.target.value)}
                        disabled={isPrePromptLoading}
                      />
                      <button
                        type="button"
                        onClick={handleFetchPrePrompt}
                        disabled={isPrePromptLoading || !prePromptIdInput.trim()}
                        className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPrePromptLoading ? '拉取中...' : '确定'}
                      </button>
                    </div>

                    {prePromptReference && (
                      <div className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2 text-xs font-semibold text-blue-700">
                          <Check size={14} className="shrink-0" />
                          <span className="truncate">引用内容：{prePromptReference.titlePreview}</span>
                        </div>
                        <button
                          type="button"
                          onClick={clearPrePromptReference}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          title="清除引用"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="max-w-[24rem] w-full mx-auto relative group">
                  <textarea rows="3" className="w-full min-h-[7rem] sm:min-h-[8rem] p-4 sm:p-5 pr-16 sm:pr-20 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 resize-none font-medium" placeholder={`向 ${CHAT_PROVIDER_LABEL[chatProvider]} 提问...`} value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onChat(); } }} />
                  <div className="absolute bottom-4 right-4">{isStreaming ? <button onClick={stopStreaming} className="p-3 bg-slate-900 text-white rounded-xl shadow-lg"><StopCircle size={20} /></button> : <button onClick={onChat} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><Send size={20} /></button>}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC]">
              <div className="max-w-[76.8rem] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-5 sm:space-y-6">
                <section className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-8 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">文流使用指南</h2>
                  <p className="mt-3 text-sm sm:text-base font-medium leading-8 text-slate-600">
                    文流（TextFlow.文流）用于沉淀和调用高频文本素材。你可以在“文字流”里管理卡片，在“AI文字助手”里结合上下文做创作与改写。
                  </p>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                  {GUIDE_SECTIONS.map((section) => (
                    <article key={section.title} className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-6 py-5 sm:py-6 shadow-sm">
                      <h3 className="text-base sm:text-lg font-black text-slate-800">{section.title}</h3>
                      <ul className="mt-3 space-y-2.5">
                        {section.points.map((point) => (
                          <li key={point} className="flex items-start gap-2.5 text-sm font-medium leading-7 text-slate-600">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-7 shadow-sm">
                  <h3 className="text-base sm:text-lg font-black text-slate-800">常用入口速查</h3>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm font-medium text-slate-600">
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <p className="font-black text-slate-700">新建卡片</p>
                      <p className="mt-2 leading-7">右上角“+”按钮，填写标题/正文/分类后保存。</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <p className="font-black text-slate-700">按ID检索</p>
                      <p className="mt-2 leading-7">顶部搜索框支持短ID与完整ID模糊匹配。</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <p className="font-black text-slate-700">AI上下文对话</p>
                      <p className="mt-2 leading-7">在 AI文字助手 中连续提问，模型会继承当前会话上下文。</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                      <p className="font-black text-slate-700">调取文本</p>
                      <p className="mt-2 leading-7">站内外可通过短ID或链接调取文本信息</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
        {activeTab !== 'chat' && (
          <footer className="shrink-0 px-4 pt-3 pb-4 text-center text-[11px] leading-5 text-slate-400">
            <p>Copyright © 2011-2026 WithMedia Co.Ltd all rights reserved</p>
            <p>内部使用 请勿外传</p>
          </footer>
        )}
      </div>

      {viewingNote && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl sm:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 sm:px-8 md:px-10 py-5 sm:py-6 md:py-8 bg-white flex justify-between items-start gap-4">
              <div className="min-w-0">
                <h3 className="text-xl md:text-2xl font-black truncate">{String(viewingNote.title || '正文')}</h3>
                <p className="text-xs font-semibold text-slate-400 mt-5 font-mono">短ID: {getNoteShortId(viewingNote) || '-'}</p>
              </div>
              <button onClick={() => setViewingNote(null)} className="p-2 border rounded-full hover:bg-slate-50 shrink-0"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/70">
              <article className="max-w-[53rem] mx-auto px-4 sm:px-6 md:px-10 py-6 sm:py-8 md:py-10">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8">
                  <div className="tf-markdown tf-full-note prose prose-slate prose-lg prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2 max-w-none leading-8">
                    <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={{ a: MarkdownLink }}>
                      {toDisplayMarkdown(viewingNote.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              </article>
            </div>
            <div className="p-4 sm:p-8 flex flex-wrap items-center justify-end gap-3 bg-slate-50/50">
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
              <button onClick={() => { setViewingNote(null); openEditNoteModal(viewingNote); }} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold">编辑内容</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-2xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black">{currentNote.id ? '编辑内容' : '新建内容'}</h3>
              <button onClick={() => { setSaveError(''); setCategoryCreateError(''); setIsAddingCategory(false); setNewCategoryName(''); setIsModalOpen(false); }} className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
              <input type="text" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 font-bold outline-none" placeholder="标题..." value={currentNote.title} onChange={(e) => setCurrentNote({ ...currentNote, title: e.target.value })} />
              <textarea rows="8" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none resize-none" placeholder="Markdown 内容..." value={currentNote.content} onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="p-5 sm:p-8 border-t flex flex-wrap justify-end gap-4 bg-slate-50/50">
              <button onClick={() => { setSaveError(''); setCategoryCreateError(''); setIsAddingCategory(false); setNewCategoryName(''); setIsModalOpen(false); }} className="px-6 py-2 text-slate-500 font-bold">放弃</button>
              <button onClick={handleSave} disabled={isSaving} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-60">{isSaving ? '保存中...' : '同步更改'}</button>
            </div>
          </div>
        </div>
      )}

      {categoryDeleteState.isOpen && (
        <div className="fixed inset-0 z-[1001] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="px-5 sm:px-8 py-5 sm:py-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-black text-red-600">删除分类</h3>
              <button onClick={closeCategoryDeleteDialog} className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 sm:p-8 space-y-5">
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
            <div className="p-5 sm:p-8 border-t flex flex-wrap justify-end gap-4 bg-slate-50/50">
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
        .tf-markdown p, .tf-markdown li, .tf-markdown blockquote { white-space: break-spaces; }
        .tf-markdown { word-break: break-word; }
        .tf-full-note p, .tf-full-note li, .tf-full-note blockquote, .tf-full-note h1, .tf-full-note h2, .tf-full-note h3, .tf-full-note h4 { white-space: break-spaces; line-height: 3.8; }
        .line-clamp-6 { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
        .animate-in { animation: tf-fade-in 0.4s ease-out; }
        @keyframes tf-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      ` }} />
    </div>
  );
};

export default App;

