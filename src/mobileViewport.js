const MOBILE_USER_AGENT_PATTERN = /(android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile)/i;

export const DEFAULT_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, viewport-fit=cover';
export const LOCKED_MOBILE_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export const isLikelyMobileContext = ({
  userAgent = '',
  coarsePointer = false,
  screenWidth = Number.POSITIVE_INFINITY,
} = {}) => {
  const normalizedUserAgent = String(userAgent || '');
  if (MOBILE_USER_AGENT_PATTERN.test(normalizedUserAgent)) return true;
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

  const isMobile = isLikelyMobileContext({
    userAgent,
    coarsePointer,
    screenWidth,
  });
  viewportMeta.setAttribute('content', resolveViewportContent(isMobile));
};
