import { useCallback, useEffect, useRef, useState } from 'react';
import { TRASH_BUTTON_REVEAL_DELAY_MS } from '../trash';

const useAppChrome = () => {
  const [viewingNote, setViewingNote] = useState(null);
  const [uiToast, setUiToast] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [isDesktopTrashButtonVisible, setIsDesktopTrashButtonVisible] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const trashRevealTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'error') => {
    const text = String(message || '').trim();
    if (!text) return;
    setUiToast({ id: Date.now(), type, message: text });
  }, []);

  const dismissToast = useCallback(() => {
    setUiToast(null);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setIsMobileSidebarOpen(false);
  }, []);

  const clearTrashRevealTimer = useCallback(() => {
    if (!trashRevealTimerRef.current) return;
    window.clearTimeout(trashRevealTimerRef.current);
    trashRevealTimerRef.current = null;
  }, []);

  const handleDesktopTrashAreaEnter = useCallback(() => {
    if (window.innerWidth < 768 || isDesktopTrashButtonVisible) return;
    clearTrashRevealTimer();
    trashRevealTimerRef.current = window.setTimeout(() => {
      setIsDesktopTrashButtonVisible(true);
      trashRevealTimerRef.current = null;
    }, TRASH_BUTTON_REVEAL_DELAY_MS);
  }, [clearTrashRevealTimer, isDesktopTrashButtonVisible]);

  const handleDesktopTrashAreaLeave = useCallback(() => {
    clearTrashRevealTimer();
    setIsDesktopTrashButtonVisible(false);
  }, [clearTrashRevealTimer]);

  const copyText = useCallback(async (text, token) => {
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
  }, []);

  useEffect(() => {
    if (!uiToast) return undefined;
    const timer = window.setTimeout(() => {
      setUiToast((prev) => (prev?.id === uiToast.id ? null : prev));
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [uiToast]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setIsMobileSidebarOpen(false);
      if (window.innerWidth < 768) {
        clearTrashRevealTimer();
        setIsDesktopTrashButtonVisible(false);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clearTrashRevealTimer]);

  useEffect(() => () => clearTrashRevealTimer(), [clearTrashRevealTimer]);

  return {
    closeMobileSidebar,
    copiedToken,
    copyText,
    dismissToast,
    handleDesktopTrashAreaEnter,
    handleDesktopTrashAreaLeave,
    isDesktopTrashButtonVisible,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setUiToast,
    setViewingNote,
    showToast,
    uiToast,
    viewingNote,
  };
};

export default useAppChrome;
