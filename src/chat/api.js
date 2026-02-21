import { supabase } from './supabaseClient';
import { isRoomCodeValid, normalizeNickname } from './utils';

const firstRow = (value) => (Array.isArray(value) ? (value[0] || null) : value || null);

const throwIfError = (error, fallbackMessage) => {
  if (!error) return;
  const message = String(error.message || error.details || fallbackMessage || 'Request failed');
  throw new Error(message);
};

export const toChatErrorMessage = (error, fallback = 'Request failed, please retry') => {
  const raw = String(error?.message || error || '');
  if (!raw) return fallback;

  if (raw.includes('ANON_AUTH_DISABLED')) {
    return 'Anonymous sign-in is disabled. Enable it in Supabase Dashboard -> Authentication -> Providers -> Anonymous.';
  }
  if (/anonymous.*(disabled|disable)/i.test(raw)) {
    return 'Anonymous sign-in is disabled in Supabase. Please enable Anonymous provider first.';
  }
  if (raw.includes('JOIN_RATE_LIMIT_USER')) return 'Join rate limit exceeded: max 10 attempts per minute (user).';
  if (raw.includes('JOIN_RATE_LIMIT_IP')) return 'Join rate limit exceeded: max 10 attempts per minute (IP).';
  if (raw.includes('ROOM_NOT_FOUND_OR_EXPIRED')) return 'Room not found or expired.';
  if (raw.includes('INVALID_ROOM_CODE')) return 'Invalid room code format (must be 4 digits).';
  if (raw.includes('INVALID_NICKNAME')) return 'Nickname must be 1-20 characters.';
  if (raw.includes('NICKNAME_REQUIRED')) return 'Please set your nickname first.';
  if (raw.includes('INVALID_MESSAGE_LENGTH')) return 'Message length must be between 1 and 500 characters.';
  if (raw.includes('ROOM_MEMBER_NOT_FOUND_OR_EXPIRED')) return 'You are no longer in this room, or the room expired.';
  if (raw.includes('AUTH_REQUIRED')) return 'Session expired. Refresh and retry.';

  return raw;
};

export const ensureAnonymousSession = async () => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  throwIfError(sessionError, 'Failed to get session');
  if (sessionData?.session?.user) return sessionData.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    const raw = String(error.message || error.details || error || '');
    if (/anonymous.*(disabled|disable)/i.test(raw)) {
      throw new Error('ANON_AUTH_DISABLED');
    }
  }
  throwIfError(error, 'Anonymous sign-in failed');
  if (!data?.user) throw new Error('Anonymous sign-in failed');
  return data.user;
};

export const createRoom = async () => {
  const { data, error } = await supabase.rpc('create_room');
  throwIfError(error, 'Create room failed');
  const row = firstRow(data);
  if (!row?.room_id || !row?.room_code || !row?.expires_at) {
    throw new Error('Create room failed, please retry');
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
  throwIfError(error, 'Join room failed');
  const row = firstRow(data);
  if (!row?.room_id || !row?.expires_at) throw new Error('ROOM_NOT_FOUND_OR_EXPIRED');
  return { roomId: row.room_id, expiresAt: row.expires_at };
};

export const setNickname = async (roomId, nicknameInput) => {
  const nickname = normalizeNickname(nicknameInput);
  const { error } = await supabase.rpc('set_nickname', { p_room_id: roomId, p_nickname: nickname });
  throwIfError(error, 'Set nickname failed');
  return nickname;
};

export const sendMessage = async (roomId, content) => {
  const { data, error } = await supabase.rpc('send_message', { p_room_id: roomId, p_content: content });
  throwIfError(error, 'Send message failed');
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
  throwIfError(error, 'Fetch messages failed');
  return Array.isArray(data) ? data : [];
};

export const fetchMyMemberState = async (roomId) => {
  const { data, error } = await supabase
    .from('room_members')
    .select('nickname')
    .eq('room_id', roomId)
    .maybeSingle();
  throwIfError(error, 'Fetch member state failed');
  return data || null;
};

export const touchMember = async (roomId) => {
  const { error } = await supabase.rpc('touch_member', { p_room_id: roomId });
  throwIfError(error, 'Heartbeat failed');
};

export const leaveRoom = async (roomId) => {
  const { data, error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  throwIfError(error, 'Leave room failed');
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
