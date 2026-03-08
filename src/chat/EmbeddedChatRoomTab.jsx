import React, { useState } from 'react';
import { ChatRoomLanding, ChatRoomPanel } from './ChatRoomExperience';

const EmbeddedChatRoomTab = () => {
  const [viewState, setViewState] = useState({ mode: 'landing', roomCode: '', bootstrap: null });

  const onEnterRoom = (roomCode, bootstrap = null) => {
    setViewState({
      mode: 'room',
      roomCode,
      bootstrap,
    });
  };

  const onBackToLanding = () => {
    setViewState({ mode: 'landing', roomCode: '', bootstrap: null });
  };

  if (viewState.mode === 'room' && viewState.roomCode) {
    return (
      <ChatRoomPanel
        roomCode={viewState.roomCode}
        bootstrap={viewState.bootstrap}
        onBackToLanding={onBackToLanding}
      />
    );
  }

  return <ChatRoomLanding onEnterRoom={onEnterRoom} />;
};

export default EmbeddedChatRoomTab;
