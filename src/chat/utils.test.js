import { describe, expect, it } from 'vitest';
import {
  formatRemainingTime,
  getRemainingMs,
  isMessageContentValid,
  isRoomCodeValid,
  normalizeNickname,
  normalizeRoomCodeInput,
} from './utils';

describe('chat utils', () => {
  it('normalizes room code input to 4 digits', () => {
    expect(normalizeRoomCodeInput(' 0a1 2-3\n4 ')).toBe('0123');
    expect(normalizeRoomCodeInput('99999')).toBe('9999');
  });

  it('validates room code format strictly', () => {
    expect(isRoomCodeValid('0000')).toBe(true);
    expect(isRoomCodeValid('1234')).toBe(true);
    expect(isRoomCodeValid('123')).toBe(false);
    expect(isRoomCodeValid('abcd')).toBe(false);
  });

  it('normalizes nickname and trims blanks', () => {
    expect(normalizeNickname('  小明  ')).toBe('小明');
    expect(normalizeNickname('   ')).toBe('');
  });

  it('validates message content length and blank-only messages', () => {
    expect(isMessageContentValid('hello')).toBe(true);
    expect(isMessageContentValid('   ')).toBe(false);
    expect(isMessageContentValid('a'.repeat(500))).toBe(true);
    expect(isMessageContentValid('a'.repeat(501))).toBe(false);
  });

  it('computes remaining milliseconds correctly', () => {
    const now = 1_000_000;
    expect(getRemainingMs(now + 10_000, now)).toBe(10_000);
    expect(getRemainingMs(now - 100, now)).toBe(0);
  });

  it('formats remaining time as mm:ss', () => {
    expect(formatRemainingTime(3_599_000)).toBe('59:59');
    expect(formatRemainingTime(61_000)).toBe('01:01');
    expect(formatRemainingTime(0)).toBe('00:00');
  });
});
