import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Check,
  Copy,
  MessageSquare,
  Send,
  StopCircle,
  X,
} from 'lucide-react';

const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];

const ChatAssistantTab = ({
  MarkdownLink,
  applyPrePromptReference,
  chatError,
  chatPrompt,
  chatProvider,
  chatProviderLabels,
  chatScrollRef,
  clearPrePromptReference,
  copiedToken,
  copyText,
  currentChatHistory,
  handleFetchPrePrompt,
  handleProviderChange,
  isPrePromptLoading,
  isStreaming,
  onChat,
  prePromptIdInput,
  prePromptReference,
  providerSwitchTip,
  setChatPrompt,
  setPrePromptIdInput,
  stopStreaming,
  toDisplayMarkdown,
  topPrePromptStats,
}) => (
  <div className="h-full flex flex-col bg-[#F8FAFC] min-w-0">
    <div className="px-4 sm:px-8 pt-4 sm:pt-5 pb-2 sm:pb-3 bg-[#F8FAFC]">
      <div className="max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] w-full mx-auto">
        <div className="rounded-2xl bg-white border border-slate-200 p-2 flex gap-2 overflow-x-auto no-scrollbar">
          {Object.keys(chatProviderLabels).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => handleProviderChange(provider)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-[10px] font-black whitespace-nowrap flex-none ${
                chatProvider === provider ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'
              }`}
            >
              {chatProviderLabels[provider]}
            </button>
          ))}
        </div>
      </div>

      {providerSwitchTip && (
        <div className="max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] w-full mx-auto mt-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
            {providerSwitchTip}
          </div>
        </div>
      )}

      {topPrePromptStats.length > 0 && (
        <div className="max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] w-full mx-auto mt-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 sm:px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-500">
              <MessageSquare size={14} />
              高频前置提示词
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {topPrePromptStats.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyPrePromptReference(item)}
                  className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  <span>{item.titlePreview}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-blue-600">x{item.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

    <div className="flex-1 min-h-0 overflow-hidden">
      <div className="h-full px-4 sm:px-8 pb-4 sm:pb-6">
        <div className="h-full max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] mx-auto flex flex-col min-w-0 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="h-8 w-8 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-black text-slate-900">AI文字助手</div>
              <div className="text-[11px] sm:text-xs font-medium text-slate-400 truncate">支持上下文连续对话与前置提示词引用</div>
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="min-h-full">
              <div className={`max-w-[72rem] w-full mx-auto ${currentChatHistory.length === 0 && !chatError ? 'h-full flex flex-col' : 'space-y-6'}`}>
                {chatError && (
                  <div className="px-4 sm:px-6 pt-4">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 flex items-center gap-2">
                      <AlertCircle size={16} />
                      <span>{chatError}</span>
                    </div>
                  </div>
                )}

                {currentChatHistory.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center px-6 py-12 text-center text-sm font-medium text-slate-400">
                    输入问题后即可开始对话，模型上下文会按当前提供商单独保留。
                  </div>
                ) : (
                  <div className="px-4 sm:px-6 py-6 space-y-6">
                    {currentChatHistory.map((item) => {
                      const isUser = item.role === 'user';
                      const copied = copiedToken === item.id;
                      return (
                        <div key={item.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[92%] sm:max-w-[85%] rounded-3xl px-4 sm:px-5 py-3.5 sm:py-4 shadow-sm min-w-0 ${
                            isUser ? 'bg-blue-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'
                          }`}>
                            <div className={`flex items-center justify-between gap-3 text-[11px] font-bold ${
                              isUser ? 'text-blue-100' : 'text-slate-400'
                            }`}>
                              <span>{isUser ? '你' : chatProviderLabels[item.provider] || '助手'}</span>
                              <button
                                type="button"
                                onClick={() => copyText(item.content, item.id)}
                                className={`inline-flex items-center gap-1 text-xs font-bold ${
                                  isUser ? 'text-blue-100 hover:text-white' : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? '已复制' : '复制'}
                              </button>
                            </div>
                            <div className={`mt-2 tf-markdown prose prose-sm sm:prose-base max-w-none break-words ${
                              isUser ? 'prose-invert' : 'prose-slate'
                            } ${isUser ? 'prose-a:text-white' : 'prose-a:text-blue-600 prose-a:underline prose-a:underline-offset-2'}`}>
                              <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={{ a: MarkdownLink }}>
                                {toDisplayMarkdown(item.content || (isStreaming && !isUser ? '...' : ''))}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-6 bg-[#F8FAFC] mt-auto">
            <div className="max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] w-full mx-auto mb-2 sm:mb-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:border-blue-300"
                    placeholder="前置提示词 ID（输入短ID或完整ID）"
                    value={prePromptIdInput}
                    onChange={(e) => setPrePromptIdInput(e.target.value)}
                    disabled={isPrePromptLoading}
                  />
                  <button
                    type="button"
                    onClick={handleFetchPrePrompt}
                    disabled={isPrePromptLoading || !prePromptIdInput.trim()}
                    className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPrePromptLoading ? '拉取中...' : '确定'}
                  </button>
                </div>

                {prePromptReference && (
                  <div className="mt-3 rounded-xl border border-blue-100 bg-white px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-xs font-semibold text-blue-700">
                      <Check size={14} className="shrink-0" />
                      <span className="truncate">引用内容：{prePromptReference.titlePreview}</span>
                    </div>
                    <button
                      type="button"
                      onClick={clearPrePromptReference}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                      title="清除引用"
                      aria-label="清除引用内容"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-[24rem] sm:max-w-[32rem] lg:max-w-[40rem] w-full mx-auto relative group">
              <textarea
                rows="3"
                className="w-full min-h-[7rem] sm:min-h-[8rem] max-h-[14rem] overflow-y-auto p-4 sm:p-5 pr-16 sm:pr-20 bg-slate-50 rounded-2xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-blue-500/5 resize-none font-medium"
                placeholder={`向 ${chatProviderLabels[chatProvider]} 提问...`}
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onChat();
                  }
                }}
              />
              <div className="absolute bottom-4 right-4">
                {isStreaming ? (
                  <button type="button" onClick={stopStreaming} aria-label="停止生成" className="p-3 bg-slate-900 text-white rounded-xl shadow-lg">
                    <StopCircle size={20} />
                  </button>
                ) : (
                  <button type="button" onClick={onChat} aria-label="发送提问" className="p-3 bg-blue-600 text-white rounded-xl shadow-lg">
                    <Send size={20} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ChatAssistantTab;
