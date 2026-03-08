import React from 'react';
import { X } from 'lucide-react';

const CategoryDeleteDialog = ({
  categoryDeleteState,
  closeCategoryDeleteDialog,
  handleCategoryDelete,
  moveToCategoryDeletePasswordStep,
  onPasswordChange,
}) => {
  if (!categoryDeleteState.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-xl rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-black text-red-600">删除分类</h3>
          <button onClick={closeCategoryDeleteDialog} aria-label="关闭删除分类弹窗" className="p-2 hover:bg-slate-50 rounded-lg"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-8 space-y-5">
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            即将删除分类：{categoryDeleteState.category?.name || '未命名分类'}
          </div>
          {categoryDeleteState.step === 1 ? (
            <p className="text-sm font-medium text-slate-600">删除后，该分类下所有文字卡片会自动改为“未分类”，卡片内容不会被删除。</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-600">请输入删除密码完成最后确认。</p>
              <input
                type="password"
                className="w-full p-4 bg-slate-50 rounded-xl border border-slate-100 outline-none"
                placeholder="请输入删除密码"
                value={categoryDeleteState.password}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
            </div>
          )}
          {categoryDeleteState.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{categoryDeleteState.error}</div>
          )}
        </div>
        <div className="p-5 sm:p-8 border-t flex flex-wrap justify-end gap-4 bg-slate-50/50">
          <button onClick={closeCategoryDeleteDialog} className="px-6 py-2 text-slate-500 font-bold">取消</button>
          {categoryDeleteState.step === 1 ? (
            <button onClick={moveToCategoryDeletePasswordStep} className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-200">继续删除</button>
          ) : (
            <button onClick={handleCategoryDelete} disabled={categoryDeleteState.isSubmitting} className="px-8 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 disabled:opacity-60">
              {categoryDeleteState.isSubmitting ? '删除中...' : '确认删除分类'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryDeleteDialog;
