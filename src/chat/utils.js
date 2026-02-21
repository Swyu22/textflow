export const normalizeRoomCodeInput = (value) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, 4);

export const isRoomCodeValid = (value) => /^[0-9]{4}$/.test(String(value ?? ''));

export const normalizeNickname = (value) => String(value ?? '').trim();

export const isMessageContentValid = (value) => {
  const content = String(value ?? '').trim();
  return content.length >= 1 && content.length <= 500;
};

export const getRemainingMs = (expiresAtMs, nowMs = Date.now()) => {
  const diff = Number(expiresAtMs) - Number(nowMs);
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return diff;
};

export const formatRemainingTime = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.floor(Number(remainingMs) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
