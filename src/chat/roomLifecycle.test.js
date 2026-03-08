import { describe, expect, it, vi } from 'vitest';
import { createRoomExitController } from './roomLifecycle';

describe('room lifecycle exit controller', () => {
  it('sends a keepalive leave request exactly once for an active room', () => {
    const leaveRoomKeepalive = vi.fn();
    const controller = createRoomExitController({
      getState: () => ({ roomId: 'room-1', isExpired: false, isLeaving: false }),
      leaveRoomKeepalive,
      unsubscribeRealtime: vi.fn(),
    });

    controller.handlePageExit();
    controller.handlePageExit();

    expect(leaveRoomKeepalive).toHaveBeenCalledTimes(1);
    expect(leaveRoomKeepalive).toHaveBeenCalledWith('room-1');
  });

  it('does not send keepalive leave when the room is already expired or leaving', () => {
    const leaveRoomKeepalive = vi.fn();
    const unsubscribeRealtime = vi.fn();
    const controller = createRoomExitController({
      getState: () => ({ roomId: 'room-1', isExpired: true, isLeaving: false }),
      leaveRoomKeepalive,
      unsubscribeRealtime,
    });

    controller.handlePageExit();

    expect(leaveRoomKeepalive).not.toHaveBeenCalled();
    expect(unsubscribeRealtime).not.toHaveBeenCalled();
  });
});
