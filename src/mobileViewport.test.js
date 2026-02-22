import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT_CONTENT,
  LOCKED_MOBILE_VIEWPORT_CONTENT,
  isLikelyMobileContext,
  resolveViewportContent,
} from './mobileViewport';

describe('mobile viewport policy', () => {
  it('locks zoom for mobile context', () => {
    expect(isLikelyMobileContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)',
      coarsePointer: true,
      screenWidth: 390,
    })).toBe(true);
    expect(resolveViewportContent(true)).toBe(LOCKED_MOBILE_VIEWPORT_CONTENT);
  });

  it('keeps normal viewport for desktop context', () => {
    expect(isLikelyMobileContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      coarsePointer: false,
      screenWidth: 1440,
    })).toBe(false);
    expect(resolveViewportContent(false)).toBe(DEFAULT_VIEWPORT_CONTENT);
  });

  it('treats iPad desktop-mode UA as mobile to avoid missing zoom lock', () => {
    expect(isLikelyMobileContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
      coarsePointer: true,
      screenWidth: 1366,
      maxTouchPoints: 5,
      platform: 'MacIntel',
    })).toBe(true);
  });
});
