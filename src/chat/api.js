import { supabase } from './supabaseClient';
import { isRoomCodeValid, normalizeNickname } from './utils';

const firstRow = (value) => (Array.isArray(value) ? (value[0] || null) : value || null);

const throwIfError = (error, fallbackMessage) => {
  if (!error) return;
  const message = String(error.message || error.details || fallbackMessage || '请求失败');
  throw new Error(message);
};

export const toChatErrorMessage = (error, fallback = '请求失败，请稍后重试') => {
  const raw = String(error?.message || error || '');
  if (!raw) return fallback;

  if (raw.includes('ANON_AUTH_DISABLED')) {
    return '匿名登录未启用。请到 Supabase Dashboard -> Authentication -> Providers 启用 Anonymous。';
  }
  if (/anonymous.*(disabled|disable)/i.test(raw)) {
    return 'Supabase 未启用匿名登录，请先开启 Anonymous Provider。';
  }
  if (raw.includes('JOIN_RATE_LIMIT_USER')) return '加入过于频繁：每分钟最多 10 次（按用户）。';
  if (raw.includes('JOIN_RATE_LIMIT_IP')) return '加入过于频繁：每分钟最多 10 次（按 IP）。';
  if (raw.includes('ROOM_NOT_FOUND_OR_EXPIRED')) return '房间不存在或已过期。';
  if (raw.includes('INVALID_ROOM_CODE')) return '房间码格式错误（仅支持 4 位数字）。';
  if (raw.includes('INVALID_NICKNAME')) return '昵称需为 1-20 字符。';
  if (raw.includes('NICKNAME_REQUIRED')) return '请先设置昵称。';
  if (raw.includes('INVALID_MESSAGE_LENGTH')) return '消息长度需在 1-500 字符。';
  if (raw.includes('ROOM_MEMBER_NOT_FOUND_OR_EXPIRED')) return '你已不在房间内，或房间已过期。';
  if (raw.includes('AUTH_REQUIRED')) return '匿名会话已失效，请刷新后重试。';

  return raw;
};

export const ensureAnonymousSession = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  throwIfError(sessionError, '获取会话失败');
  if (sessionData?.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    const raw = String(error.message || error.details || error || '');
    if (/anonymous.*(disabled|disable)/i.test(raw)) {
      throw new Error('ANON_AUTH_DISABLED');
    }
  }
  throwIfError(error, '匿名登录失败');
  if (!data?.user) throw new Error('匿名登录失败');
  return data.user;
};

export const createRoom = async () => {
  const { data, error } = await supabase.rpc('create_room');
  throwIfError(error, '创建房间失败');
  const row = firstRow(data);
  if (!row?.room_id || !row?.room_code || !row?.expires_at) {
    throw new Error('创建房间失败，请稍后重试');
  }
  return {
    roomId: row.room_id,
    roomCode: row.room_code,
    expiresAt: row.expires_at,
  };
};

export const joinRoom = async (roomCode) => {
  if (!isRoomCodeValid(roomCode)) throw new Error('INVALID_ROOM_CODE');
  const { data, error } = await supabase.rpc('join_room', { p_code: roomCode });
  throwIfError(error, '加入房间失败');
  const row = firstRow(data);
  if (!row?.room_id || !row?.expires_at) throw new Error('ROOM_NOT_FOUND_OR_EXPIRED');
  return { roomId: row.room_id, expiresAt: row.expires_at };
};

export const setNickname = async (roomId, nicknameInput) => {
  const nickname = normalizeNickname(nicknameInput);
  const { error } = await supabase.rpc('set_nickname', { p_room_id: roomId, p_nickname: nickname });
  throwIfError(error, '设置昵称失败');
  return nickname;
};

export const sendMessage = async (roomId, content) => {
  const { data, error } = await supabase.rpc('send_message', { p_room_id: roomId, p_content: content });
  throwIfError(error, '发送失败');
  const row = firstRow(data);
  return row
    ? {
      id: row.id,
      room_id: row.room_id,
      nickname: row.nickname,
      content: row.content,
      created_at: row.created_at,
    }
    : null;
};

export const fetchMessages = async (roomId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, room_id, nickname, content, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(2000);
  throwIfError(error, '读取历史消息失败');
  return Array.isArray(data) ? data : [];
};

export const fetchMyMemberState = async (roomId) => {
  const { data, error } = await supabase
    .from('room_members')
    .select('nickname')
    .eq('room_id', roomId)
    .maybeSingle();
  throwIfError(error, '读取成员信息失败');
  return data || null;
};

export const touchMember = async (roomId) => {
  const { error } = await supabase.rpc('touch_member', { p_room_id: roomId });
  throwIfError(error, '心跳失败');
};

export const leaveRoom = async (roomId) => {
  const { data, error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  throwIfError(error, '退出房间失败');
  return Boolean(data);
};

export const logChatEvent = async (eventType, roomId = null, eventMeta = {}) => {
  const { error } = await supabase.rpc('log_chat_event', {
    p_event_type: eventType,
    p_room_id: roomId,
    p_event_meta: eventMeta,
  });
  if (error) {
    // Do not block UX for analytics failure.
    console.warn('log_chat_event failed', error.message || error);
  }
};

export const subscribeMessages = (roomId, onInsert, onStatus) => {
  const channel = supabase
    .channel(`chat-room-${roomId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        if (payload?.new) onInsert(payload.new);
      },
    )
    .subscribe((status) => onStatus?.(status));

  return channel;
};

export const unsubscribeMessages = async (channel) => {
  if (!channel) return;
  await supabase.removeChannel(channel);
};
