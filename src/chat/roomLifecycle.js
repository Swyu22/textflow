export const createRoomExitController = ({
  getState,
  leaveRoomKeepalive,
  unsubscribeRealtime,
}) => {
  let handled = false;

  const handlePageExit = () => {
    if (handled) return false;

    const state = typeof getState === 'function' ? getState() : null;
    const roomId = state?.roomId || '';
    if (!roomId || state?.isExpired || state?.isLeaving) return false;

    handled = true;
    unsubscribeRealtime?.();
    void leaveRoomKeepalive?.(roomId);
    return true;
  };

  return {
    handlePageExit,
    markHandled() {
      handled = true;
    },
    reset() {
      handled = false;
    },
  };
};
