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
      '临时 ChatRoom',
      '匿名昵称聊天，房间码 4 位数字。',
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
  });
});
