import React from 'react';
import { AlertCircle, Check, WifiOff, X } from 'lucide-react';

const AppOverlays = ({ closeMobileSidebar, connErrorMessage, connStatus, dismissToast, fetchData, isMobileSidebarOpen, uiToast }) => (
  <>
    {connStatus === 'offline' && (
      <div aria-live="assertive" className="fixed top-0 left-0 right-0 z-[999] bg-red-600 text-white text-[10px] font-bold py-2 px-6 flex justify-between items-center shadow-lg animate-in slide-in-from-top">
        <div className="flex items-center gap-2"><WifiOff size={14} /> 后端连接异常: {String(connErrorMessage)}</div>
        <button onClick={fetchData} className="bg-white/20 px-3 py-1 rounded-full text-[10px] hover:bg-white/30">尝试重连</button>
      </div>
    )}

    {uiToast && (
      <div aria-live="polite" className={`fixed right-4 top-16 z-[1201] max-w-xs sm:max-w-sm rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${uiToast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
        <div className="flex items-start gap-2">
          {uiToast.type === 'success' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <p className="text-xs font-semibold leading-5 flex-1">{uiToast.message}</p>
          <button type="button" onClick={dismissToast} className="p-0.5 opacity-70 hover:opacity-100" aria-label="关闭提示">
            <X size={14} />
          </button>
        </div>
      </div>
    )}

    {isMobileSidebarOpen && (
      <button
        type="button"
        aria-label="关闭侧边栏"
        onClick={closeMobileSidebar}
        className="fixed inset-0 z-[1040] bg-slate-900/35 backdrop-blur-[1px] md:hidden"
      />
    )}
  </>
);

export default AppOverlays;
