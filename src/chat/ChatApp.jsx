import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, LogOut, MessageSquareText, Plus, Timer, UserRound } from 'lucide-react';
import {
  createRoom,
  ensureAnonymousSession,
  fetchMessages,
  fetchMyMemberState,
  joinRoom,
  leaveRoom,
  logChatEvent,
  sendMessage,
  setNickname,
  subscribeMessages,
  toChatErrorMessage,
  touchMember,
  unsubscribeMessages,
} from './api';
import {
  formatRemainingTime,
  getRemainingMs,
  isMessageContentValid,
  isRoomCodeValid,
  normalizeNickname,
  normalizeRoomCodeInput,
} from './utils';

const parseChatPath = (pathname) => {
  const cleaned = String(pathname || '').replace(/\/+$/, '') || '/';
  if (cleaned === '/chat') return { type: 'landing' };
  const match = cleaned.match(/^\/chat\/([0-9]{4})$/);
  if (match) return { type: 'room', code: match[1] };
  return { type: 'not_found' };
};

const buildRouteState = (pathname, navState = null) => ({
  ...parseChatPath(pathname),
  navState: navState && typeof navState === 'object' ? navState : null,
});

const copyText = async (value) => {
  const text = String(value || '');
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
};

const mergeMessages = (prev, nextList) => {
  const map = new Map();
  for (const item of prev || []) map.set(String(item.id), item);
  for (const item of nextList || []) map.set(String(item.id), item);
  return Array.from(map.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};

const toTime = (iso) => {
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return '--:--';
  return time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const ChatLanding = ({ onNavigateRoom }) => {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const onCreate = async () => {
    setError('');
    setBusyAction('create');
    try {
      await ensureAnonymousSession();
      const created = await createRoom();
      onNavigateRoom(created.roomCode, {
        code: created.roomCode,
        roomId: created.roomId,
        expiresAt: created.expiresAt,
        joined: true,
      });
    } catch (err) {
      setError(toChatErrorMessage(err, '创建失败，请重试'));
      logChatEvent('error', null, { stage: 'create', reason: String(err?.message || err) }).catch(() => {});
    } finally {
      setBusyAction('');
    }
  };

  const onJoin = async () => {
    setError('');
    const code = normalizeRoomCodeInput(joinCode);
    if (!isRoomCodeValid(code)) {
      setError('请输入 4 位数字房间码');
      return;
    }

    setBusyAction('join');
    try {
      await ensureAnonymousSession();
      const joined = await joinRoom(code);
      onNavigateRoom(code, {
        code,
        roomId: joined.roomId,
        expiresAt: joined.expiresAt,
        joined: true,
      });
    } catch (err) {
      setError(toChatErrorMessage(err, '加入失败，请重试'));
      logChatEvent('error', null, {
        stage: 'join_from_landing',
        room_code: code,
        reason: String(err?.message || err),
      }).catch(() => {});
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-cyan-50 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-9">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
            <MessageSquareText size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">匿名房间码聊天室</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              无需注册，输入 4 位码即可加入。房间创建后 1 小时自动失效，最后一人退出立即销毁。
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onCreate}
            disabled={busyAction !== ''}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            {busyAction === 'create' ? '创建中...' : '新建房间'}
          </button>

          <button
            type="button"
            onClick={onJoin}
            disabled={busyAction !== ''}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyAction === 'join' ? '加入中...' : '加入房间'}
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="join-room-code" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
            房间码（4 位数字）
          </label>
          <input
            id="join-room-code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={joinCode}
            onChange={(e) => {
              setJoinCode(normalizeRoomCodeInput(e.target.value));
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onJoin();
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-black tracking-[0.35em] text-slate-900 outline-none placeholder:tracking-normal placeholder:text-sm placeholder:font-medium focus:border-cyan-500"
            placeholder="0000"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatRoom = ({ code, bootstrap, onBackToLanding }) => {
  const [roomId, setRoomId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [messages, setMessages] = useState([]);
  const [bootState, setBootState] = useState('loading');
  const [statusText, setStatusText] = useState('正在连接...');
  const [error, setError] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [nickname, setNicknameState] = useState('');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [nicknameModalOpen, setNicknameModalOpen] = useState(true);
  const [savingNickname, setSavingNickname] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const messageListRef = useRef(null);
  const channelRef = useRef(null);
  const subscribedOnceRef = useRef(false);
  const expiredHandledRef = useRef(false);

  const expiresAtMs = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const remainingMs = useMemo(() => getRemainingMs(expiresAtMs, nowMs), [expiresAtMs, nowMs]);
  const isExpired = remainingMs <= 0;

  const appendMessage = useCallback((message) => {
    if (!message?.id) return;
    setMessages((prev) => mergeMessages(prev, [message]));
  }, []);

  const refreshMessages = useCallback(async () => {
    if (!roomId) return;
    const latest = await fetchMessages(roomId);
    setMessages((prev) => mergeMessages(prev, latest));
  }, [roomId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const container = messageListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const initRoom = async () => {
      setBootState('loading');
      setError('');
      setStatusText('正在连接...');
      setMessages([]);
      setRoomId('');
      setExpiresAt('');
      setNicknameState('');
      setNicknameDraft('');
      setNicknameModalOpen(true);
      subscribedOnceRef.current = false;
      expiredHandledRef.current = false;

      try {
        await ensureAnonymousSession();
        const canUseBootstrap = (
          bootstrap?.joined === true
          && bootstrap?.code === code
          && typeof bootstrap?.roomId === 'string'
          && typeof bootstrap?.expiresAt === 'string'
        );

        const joined = canUseBootstrap
          ? { roomId: bootstrap.roomId, expiresAt: bootstrap.expiresAt }
          : await joinRoom(code);
        if (cancelled) return;

        setRoomId(joined.roomId);
        setExpiresAt(joined.expiresAt);

        const [history, member] = await Promise.all([
          fetchMessages(joined.roomId),
          fetchMyMemberState(joined.roomId),
        ]);
        if (cancelled) return;

        setMessages(history);
        const presetNickname = normalizeNickname(member?.nickname || '');
        setNicknameState(presetNickname);
        setNicknameDraft(presetNickname);
        setNicknameModalOpen(true);
        setBootState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(toChatErrorMessage(err, '房间不存在或已过期'));
        setBootState('error');
        logChatEvent('error', null, {
          stage: 'room_init',
          room_code: code,
          reason: String(err?.message || err),
        }).catch(() => {});
      }
    };

    initRoom();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, code]);

  useEffect(() => {
    if (!roomId) return undefined;

    const channel = subscribeMessages(
      roomId,
      (row) => appendMessage(row),
      async (status) => {
        if (status === 'CHANNEL_ERROR') {
          setStatusText('实时连接异常，正在重连...');
          return;
        }
        if (status === 'TIMED_OUT') {
          setStatusText('连接超时，正在重连...');
          return;
        }
        if (status === 'SUBSCRIBED') {
          setStatusText('实时连接正常');
          if (subscribedOnceRef.current) {
            try {
              await refreshMessages();
            } catch {
              // ignore refresh error and keep realtime stream alive
            }
          }
          subscribedOnceRef.current = true;
        }
      },
    );

    channelRef.current = channel;

    return () => {
      const currentChannel = channelRef.current;
      channelRef.current = null;
      unsubscribeMessages(currentChannel).catch(() => {});
    };
  }, [appendMessage, refreshMessages, roomId]);

  useEffect(() => {
    if (!roomId || isExpired) return undefined;

    touchMember(roomId).catch(() => {});
    const timer = window.setInterval(() => {
      touchMember(roomId).catch(() => {});
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [roomId, isExpired]);

  useEffect(() => {
    if (!isExpired || !roomId || expiredHandledRef.current) return;
    expiredHandledRef.current = true;
    setStatusText('房间已到期');
    setError('房间已到期，记录已销毁/不可再发送');

    const currentChannel = channelRef.current;
    channelRef.current = null;
    unsubscribeMessages(currentChannel).catch(() => {});
    leaveRoom(roomId).catch(() => {});
    logChatEvent('expired', roomId, { room_code: code }).catch(() => {});
  }, [code, isExpired, roomId]);

  const onSaveNickname = async () => {
    const normalized = normalizeNickname(nicknameDraft);
    if (!normalized || normalized.length > 20) {
      setError('昵称需为 1-20 字符，且不能全空格');
      return;
    }

    if (!roomId) return;
    setSavingNickname(true);
    setError('');
    try {
      await setNickname(roomId, normalized);
      setNicknameState(normalized);
      setNicknameModalOpen(false);
    } catch (err) {
      setError(toChatErrorMessage(err, '设置昵称失败'));
    } finally {
      setSavingNickname(false);
    }
  };

  const onSend = async () => {
    if (!roomId || isExpired) return;
    if (!nickname) {
      setNicknameModalOpen(true);
      setError('请先设置昵称');
      return;
    }

    const content = String(messageInput || '').trim();
    if (!isMessageContentValid(content)) {
      setError('消息需为 1-500 字符，且不能全空格');
      return;
    }

    setIsSending(true);
    setError('');
    try {
      const inserted = await sendMessage(roomId, content);
      if (inserted) appendMessage(inserted);
      setMessageInput('');
      touchMember(roomId).catch(() => {});
    } catch (err) {
      setError(toChatErrorMessage(err, '发送失败'));
      logChatEvent('error', roomId, { stage: 'send_message', reason: String(err?.message || err) }).catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  const onCopyCode = async () => {
    const ok = await copyText(code);
    if (!ok) {
      setError('复制失败，请手动复制');
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const onLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      if (roomId) await leaveRoom(roomId);
    } catch (err) {
      setError(toChatErrorMessage(err, '退出房间失败'));
    } finally {
      const currentChannel = channelRef.current;
      channelRef.current = null;
      unsubscribeMessages(currentChannel).catch(() => {});
      onBackToLanding();
    }
  };

  if (bootState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          正在进入房间 {code} ...
        </div>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white p-8 text-center">
          <p className="text-base font-bold text-red-600">{error || '房间不可用'}</p>
          <button
            type="button"
            onClick={onBackToLanding}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            返回聊天首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex h-screen max-w-5xl flex-col px-3 py-3 sm:px-4 sm:py-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:text-sm"
            >
              <ArrowLeft size={16} />
              返回
            </button>

            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
              <span className="text-xs font-bold text-slate-500">房间码</span>
              <button
                type="button"
                onClick={onCopyCode}
                className="inline-flex items-center gap-1 text-sm font-black text-slate-900 hover:text-cyan-700"
              >
                {code}
                <Copy size={14} />
              </button>
              <span className="text-[11px] font-semibold text-cyan-700">{copied ? '已复制' : ''}</span>
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 sm:text-sm">
              <Timer size={14} />
              {isExpired ? '已到期' : `剩余 ${formatRemainingTime(remainingMs)}`}
            </div>

            <button
              type="button"
              onClick={onLeave}
              disabled={leaving}
              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-60 sm:text-sm"
            >
              <LogOut size={14} />
              {leaving ? '退出中...' : '退出'}
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">{statusText}</p>
        </header>

        <main className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">
                暂无消息，开始聊天吧。
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-500">
                      <UserRound size={13} />
                      <span>{item.nickname || '匿名用户'}</span>
                      <span className="text-slate-400">{toTime(item.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.content || ''}</p>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={messageInput}
                onChange={(e) => {
                  if (error) setError('');
                  setMessageInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                maxLength={500}
                disabled={isExpired || nicknameModalOpen || isSending}
                placeholder={isExpired ? '房间已到期，无法发送消息' : '输入消息，Enter 发送'}
                className="min-h-[70px] flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={onSend}
                disabled={isExpired || nicknameModalOpen || isSending}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? '发送中...' : '发送'}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{nickname ? `昵称：${nickname}` : '未设置昵称'}</span>
              <span>{messageInput.trim().length}/500</span>
            </div>

            {error && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                {error}
              </div>
            )}
          </div>
        </main>
      </div>

      {nicknameModalOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900">设置聊天昵称</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">昵称仅在当前房间显示，不会展示 TextFlow 账号信息。</p>

            <input
              type="text"
              value={nicknameDraft}
              maxLength={20}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveNickname();
              }}
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-500"
              placeholder="请输入 1-20 字昵称"
              autoFocus
            />
            <p className="mt-1 text-right text-xs text-slate-400">{normalizeNickname(nicknameDraft).length}/20</p>

            <button
              type="button"
              onClick={onSaveNickname}
              disabled={savingNickname}
              className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingNickname ? '保存中...' : '确认进入'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatNotFound = ({ onBack }) => (
  <div className="min-h-screen bg-slate-100 px-4 py-10">
    <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-black text-slate-900">聊天路径无效</h1>
      <p className="mt-2 text-sm font-medium text-slate-600">请通过 `/chat` 进入并创建/加入房间。</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={16} />
        返回聊天首页
      </button>
    </div>
  </div>
);

const ChatApp = () => {
  const [route, setRoute] = useState(() => buildRouteState(window.location.pathname, window.history.state));

  useEffect(() => {
    const onPopState = (event) => setRoute(buildRouteState(window.location.pathname, event.state));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((path, replace = false, state = null) => {
    if (replace) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
    setRoute(buildRouteState(path, state));
  }, []);

  if (route.type === 'landing') {
    return <ChatLanding onNavigateRoom={(code, bootstrapState) => navigateTo(`/chat/${code}`, false, bootstrapState)} />;
  }

  if (route.type === 'room') {
    return <ChatRoom code={route.code} bootstrap={route.navState} onBackToLanding={() => navigateTo('/chat', true, null)} />;
  }

  return <ChatNotFound onBack={() => navigateTo('/chat', true, null)} />;
};

export default ChatApp;
