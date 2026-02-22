import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('EmbeddedChatRoomTab copy', () => {
  it('uses readable Chinese text instead of mojibake', () => {
    const source = readFileSync(new URL('./EmbeddedChatRoomTab.jsx', import.meta.url), 'utf8');

    const mojibakeTokens = [
      '鍒涘缓',
      '璇疯緭鍏',
      '鍔犲叆',
      '姝ｅ湪杩炴帴',
      '瀹炴椂杩炴帴',
      '鏆傛棤娑堟伅',
      '鍖垮悕',
      '璁剧疆鑱婂ぉ鏄电О',
    ];

    mojibakeTokens.forEach((token) => {
      expect(source).not.toContain(token);
    });

    const expectedChineseCopy = [
      'FlowChat.一阅即散',
      '房间码为四位数字，房间创建1小时或所有人退出后自动失效',
      '房间码（4 位数字）',
      '正在连接...',
      '实时连接正常',
      '暂无消息，开始聊天吧。',
      '匿名用户',
      '设置聊天昵称',
    ];

    expectedChineseCopy.forEach((snippet) => {
      expect(source).toContain(snippet);
    });

    expect(source).not.toContain('临时 ChatRoom');
    expect(source).not.toContain('匿名昵称聊天，房间码 4 位数字。');
    expect(source).toContain("返回流式聊天");
    expect(source).toContain(
      "className=\"inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60\"",
    );
    expect(source).toContain(
      "className=\"inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60\"",
    );
  });
});
