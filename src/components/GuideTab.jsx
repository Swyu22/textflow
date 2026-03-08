import React from 'react';

const GuideTab = ({ sections }) => (
  <div className="h-full overflow-y-auto custom-scrollbar bg-[#F8FAFC]">
    <div className="max-w-[76.8rem] mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-5 sm:space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-8 shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">文流使用指南</h2>
        <p className="mt-3 text-sm sm:text-base font-medium leading-8 text-slate-600">
          文流（TextFlow.文流）用于沉淀和调用高频文本素材。你可以在“文字流”里管理卡片，在“AI文字助手”里结合上下文做创作与改写。
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {sections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-6 py-5 sm:py-6 shadow-sm">
            <h3 className="text-base sm:text-lg font-black text-slate-800">{section.title}</h3>
            <ul className="mt-3 space-y-2.5">
              {section.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm font-medium leading-7 text-slate-600">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white px-5 sm:px-8 py-6 sm:py-7 shadow-sm">
        <h3 className="text-base sm:text-lg font-black text-slate-800">常用入口速查</h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm font-medium text-slate-600">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="font-black text-slate-700">新建卡片</p>
            <p className="mt-2 leading-7">右上角“+”按钮，填写标题/正文/分类后保存。</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="font-black text-slate-700">按ID检索</p>
            <p className="mt-2 leading-7">顶部搜索框支持短ID与完整ID模糊匹配。</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="font-black text-slate-700">AI上下文对话</p>
            <p className="mt-2 leading-7">在 AI文字助手 中连续提问，模型会继承当前会话上下文。</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <p className="font-black text-slate-700">调取文本</p>
            <p className="mt-2 leading-7">站内外可通过短ID或链接调取文本信息</p>
          </div>
        </div>
      </section>
    </div>
  </div>
);

export default GuideTab;
