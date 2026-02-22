const MOBILE_USER_AGENT_PATTERN = /(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile)/i;

export const DEFAULT_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, viewport-fit=cover';
export const LOCKED_MOBILE_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export const isLikelyMobileContext = ({
  userAgent = '',
  coarsePointer = false,
  screenWidth = Number.POSITIVE_INFINITY,
  maxTouchPoints = 0,
  platform = '',
  userAgentDataMobile,
} = {}) => {
  const normalizedUserAgent = String(userAgent || '');
  if (typeof userAgentDataMobile === 'boolean' && userAgentDataMobile) return true;
  if (MOBILE_USER_AGENT_PATTERN.test(normalizedUserAgent)) return true;
  const normalizedPlatform = String(platform || '');
  const isIpadDesktopMode = (
    /macintosh/i.test(normalizedUserAgent)
    && /mac/i.test(normalizedPlatform)
    && Number(maxTouchPoints) > 1
  );
  if (isIpadDesktopMode) return true;
  return Boolean(coarsePointer) && Number(screenWidth) <= 1024;
};

export const resolveViewportContent = (isMobile) => (
  isMobile ? LOCKED_MOBILE_VIEWPORT_CONTENT : DEFAULT_VIEWPORT_CONTENT
);

export const applyViewportPolicy = () => {
  if (typeof document === 'undefined') return;

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) return;

  const coarsePointer = (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches
  );
  const screenWidth = (
    typeof window !== 'undefined'
      ? (window.innerWidth || document.documentElement?.clientWidth || Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY
  );
  const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const maxTouchPoints = typeof navigator !== 'undefined' ? Number(navigator.maxTouchPoints || 0) : 0;
  const platform = typeof navigator !== 'undefined' ? (navigator.platform || '') : '';
  const userAgentDataMobile = typeof navigator !== 'undefined' ? navigator.userAgentData?.mobile : undefined;

  const isMobile = isLikelyMobileContext({
    userAgent,
    coarsePointer,
    screenWidth,
    maxTouchPoints,
    platform,
    userAgentDataMobile,
  });
  viewportMeta.setAttribute('content', resolveViewportContent(isMobile));
};
