import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CHAT_PROVIDER_LABEL = {
  deepseek: 'DeepSeek Reasoner + Search',
  gemini: 'Gemini 3.0 Pro + Search',
  chatgpt: 'GPT 5.2 Thinking + Search',
};
const CHAT_MODEL_BY_PROVIDER = {
  deepseek: 'deepseek-reasoner',
  gemini: 'gemini-3.0-pro',
  chatgpt: 'gpt-5.2',
};
const MAX_CONTEXT_MESSAGES = 12;
const PRE_PROMPT_PREVIEW_LENGTH = 10;
const SHORT_ID_LENGTH = 8;

const createEmptyHistoryMap = () => ({ deepseek: [], gemini: [], chatgpt: [] });
const toShortId = (rawId) => String(rawId ?? '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, SHORT_ID_LENGTH)
  .toUpperCase();
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

const tryParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const extractErrorMessage = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const message = extractErrorMessage(item);
      if (message) return message;
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
  const normalizedMessage = String(message || '请求失败');
  if (provider === 'gemini' && /models\/.+ is not found/i.test(normalizedMessage)) {
    return 'Gemini 模型不可用。前端已切换为 gemini-3.0-pro（并带回退模型）；若仍报错，请检查 Supabase Edge Function 的 Gemini 模型路由与权限。';
  }
  if (provider === 'gemini' && /Incorrect API key provided:\s*AIza/i.test(normalizedMessage)) {
    return 'Gemini 请求被错误转发到了 OpenAI。请在 Supabase Edge Function 中将 gemini 路由到 Google 接口并使用 GEMINI_API_KEY。';
  }
  return normalizedMessage;
};

const useChatStream = (baseUrl, withApiKeyHeaders) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const sendMessage = useCallback(async ({ prompt, provider, contextMessages = [], onChunk }) => {
    setError(null);
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    let collected = '';
    try {
      const composedPrompt = buildPromptWithContext(prompt, contextMessages);
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        signal: abortControllerRef.current.signal,
        headers: withApiKeyHeaders({ 'Content-Type': 'application/json' }),
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
    } catch (error) {
      if (error.name !== 'AbortError') {
        const normalized = normalizeChatError(error.message || error, provider);
        setError(normalized);
        throw new Error(normalized);
      }
      return collected;
    } finally {
      setIsStreaming(false);
    }
  }, [baseUrl, withApiKeyHeaders]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { error, isStreaming, sendMessage, stopStreaming };
};

const useChatAssistant = ({
  connStatus,
  getNoteShortId,
  notes,
  setUiToast,
  supabaseFuncUrl,
  withApiKeyHeaders,
}) => {
  const [chatProvider, setChatProvider] = useState('deepseek');
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatHistoryByProvider, setChatHistoryByProvider] = useState(() => createEmptyHistoryMap());
  const [providerSwitchTip, setProviderSwitchTip] = useState('');
  const [prePromptIdInput, setPrePromptIdInput] = useState('');
  const [prePromptReference, setPrePromptReference] = useState(null);
  const [prePromptUsageStats, setPrePromptUsageStats] = useState({});
  const [isPrePromptLoading, setIsPrePromptLoading] = useState(false);
  const chatScrollRef = useRef(null);

  const pushToast = useCallback((message, type = 'error') => {
    const text = String(message || '').trim();
    if (!text) return;
    setUiToast({ id: Date.now(), type, message: text });
  }, [setUiToast]);

  const { sendMessage, stopStreaming, isStreaming, error: chatError } = useChatStream(supabaseFuncUrl, withApiKeyHeaders);
  const currentChatHistory = useMemo(() => chatHistoryByProvider[chatProvider] || [], [chatHistoryByProvider, chatProvider]);
  const noteLookupByExternalId = useMemo(() => {
    const lookup = new Map();
    (notes || []).forEach((note) => {
      const shortId = getNoteShortId(note).toLowerCase();
      const fullId = String(note?.id || '').trim().toLowerCase();
      if (shortId && !lookup.has(shortId)) lookup.set(shortId, note);
      if (fullId && !lookup.has(fullId)) lookup.set(fullId, note);
    });
    return lookup;
  }, [getNoteShortId, notes]);
  const topPrePromptStats = useMemo(
    () => Object.values(prePromptUsageStats || {})
      .sort((a, b) => (b.count || 0) - (a.count || 0) || (b.lastFetchedAt || 0) - (a.lastFetchedAt || 0))
      .slice(0, 8),
    [prePromptUsageStats],
  );

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return undefined;
    const rafId = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [currentChatHistory, isStreaming]);

  useEffect(() => {
    if (!providerSwitchTip) return undefined;
    const timer = window.setTimeout(() => setProviderSwitchTip(''), 2400);
    return () => window.clearTimeout(timer);
  }, [providerSwitchTip]);

  const handleProviderChange = useCallback((nextProvider) => {
    if (nextProvider === chatProvider) return;

    const wasStreaming = isStreaming;
    if (wasStreaming) stopStreaming();

    const nextHistory = chatHistoryByProvider[nextProvider] || [];
    const roundCount = nextHistory.filter((item) => item.role === 'user').length;
    const baseTip = roundCount > 0
      ? `已切换到 ${CHAT_PROVIDER_LABEL[nextProvider]}，将继续该模型的上下文（${roundCount} 轮）。`
      : `已切换到 ${CHAT_PROVIDER_LABEL[nextProvider]}，该模型暂无上下文，将开始新对话。`;

    setChatProvider(nextProvider);
    setProviderSwitchTip(wasStreaming ? `${baseTip} 已停止上一模型生成。` : baseTip);
  }, [chatHistoryByProvider, chatProvider, isStreaming, stopStreaming]);

  const findNoteByExternalId = useCallback((externalId) => {
    const target = String(externalId || '').trim().toLowerCase();
    if (!target) return null;
    return noteLookupByExternalId.get(target) || null;
  }, [noteLookupByExternalId]);

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

  const clearPrePromptReference = useCallback(() => {
    setPrePromptReference(null);
    setPrePromptIdInput('');
  }, []);

  const handleFetchPrePrompt = useCallback(async () => {
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
        pushToast('未找到对应文案，请检查ID');
        return;
      } else {
        const response = await fetch(`${supabaseFuncUrl}/notes/${encodeURIComponent(externalId)}`, {
          headers: withApiKeyHeaders(),
        });
        const responseContentType = response.headers.get('content-type') || '';
        const isJsonResponse = responseContentType.includes('application/json');
        const payload = isJsonResponse ? await response.json().catch(() => null) : null;
        const plainText = isJsonResponse ? '' : await response.text().catch(() => '');
        const responseError = extractErrorMessage(payload) || plainText;

        if (response.status === 404 || /invalid input syntax for type uuid/i.test(responseError)) {
          pushToast('未找到对应文案，请检查ID');
          return;
        }

        if (response.status === 409) {
          pushToast(responseError || '短ID不唯一，请使用完整ID查询。');
          return;
        }

        if (!response.ok) throw new Error(responseError || `HTTP ${response.status}`);

        if (isJsonResponse) {
          if (payload?.ok === false) {
            const errorMessage = extractErrorMessage(payload);
            if (/不存在|not found/i.test(errorMessage)) {
              pushToast('未找到对应文案，请检查ID');
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
        pushToast('该ID对应的文案内容为空');
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
      pushToast('获取前置信息失败');
    } finally {
      setIsPrePromptLoading(false);
    }
  }, [applyPrePromptReference, connStatus, findNoteByExternalId, isPrePromptLoading, prePromptIdInput, pushToast, recordPrePromptUsage, supabaseFuncUrl, withApiKeyHeaders]);

  const onChat = useCallback(async () => {
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
          startTransition(() => {
            setChatHistoryByProvider((prev) => ({
              ...prev,
              [providerAtSend]: (prev[providerAtSend] || []).map((item) =>
                item.id === assistantId ? { ...item, content: `${item.content}${chunk}` } : item,
              ),
            }));
          });
        },
      });
    } catch (error) {
      setChatHistoryByProvider((prev) => ({
        ...prev,
        [providerAtSend]: (prev[providerAtSend] || []).map((item) =>
          item.id === assistantId && !item.content
            ? { ...item, content: `请求失败: ${String(error.message || error)}` }
            : item,
        ),
      }));
    }
  }, [chatHistoryByProvider, chatPrompt, chatProvider, isStreaming, prePromptReference?.content, sendMessage]);

  return {
    applyPrePromptReference,
    chatError,
    chatPrompt,
    chatProvider,
    chatProviderLabels: CHAT_PROVIDER_LABEL,
    chatScrollRef,
    clearPrePromptReference,
    currentChatHistory,
    handleFetchPrePrompt,
    handleProviderChange,
    isPrePromptLoading,
    isStreaming,
    onChat,
    prePromptIdInput,
    prePromptReference,
    providerSwitchTip,
    setChatPrompt,
    setPrePromptIdInput,
    stopStreaming,
    topPrePromptStats,
  };
};

export default useChatAssistant;
