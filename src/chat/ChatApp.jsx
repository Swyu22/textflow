import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ChatRoomLanding, ChatRoomPanel } from './ChatRoomExperience';
import { chatCopy } from './chatCopy';

const parseChatPath = (pathname) => {
  const cleaned = String(pathname || '').replace(/\/+$/, '') || '/';
  if (cleaned === '/chat') return { type: 'landing' };
  const match = cleaned.match(/^\/chat\/([0-9]{4})$/);
  if (match) return { type: 'room', code: match[1] };
  return { type: 'not_found' };
};

const buildRouteState = (pathname, navState = null) => ({
  ...parseChatPath(pathname),
  navState: navState && typeof navState === 'object' ? navState : null,
});

const ChatNotFound = ({ onBack }) => (
  <div className="min-h-screen bg-slate-100 px-4 py-10">
    <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-black text-slate-900">{chatCopy.invalidPathTitle}</h1>
      <p className="mt-2 text-sm font-medium text-slate-600">{chatCopy.invalidPathDescription}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        <ArrowLeft size={16} />
        {chatCopy.backToChat}
      </button>
    </div>
  </div>
);

const ChatApp = () => {
  const [route, setRoute] = useState(() => buildRouteState(window.location.pathname, window.history.state));

  useEffect(() => {
    const onPopState = (event) => setRoute(buildRouteState(window.location.pathname, event.state));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = useCallback((path, replace = false, state = null) => {
    if (replace) window.history.replaceState(state, '', path);
    else window.history.pushState(state, '', path);
    setRoute(buildRouteState(path, state));
  }, []);

  if (route.type === 'landing') {
    return <ChatRoomLanding onEnterRoom={(code, bootstrapState) => navigateTo(`/chat/${code}`, false, bootstrapState)} />;
  }

  if (route.type === 'room') {
    return <ChatRoomPanel roomCode={route.code} bootstrap={route.navState} onBackToLanding={() => navigateTo('/chat', true, null)} />;
  }

  return <ChatNotFound onBack={() => navigateTo('/chat', true, null)} />;
};

export default ChatApp;
