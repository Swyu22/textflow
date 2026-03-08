import { describe, expect, it } from 'vitest';
import { chatCopy } from './chatCopy';

describe('chat copy', () => {
  it('uses readable Chinese strings for the shared chat experience', () => {
    expect(chatCopy.title).toBe('FlowChat.一阅即散');
    expect(chatCopy.description).toBe('房间码为四位数字，房间创建1小时或所有人退出后自动失效');
    expect(chatCopy.backToChat).toBe('返回流式聊天');
    expect(chatCopy.messagesEmpty).toBe('暂无消息，开始聊天吧。');
    expect(chatCopy.nicknameTitle).toBe('设置聊天昵称');
  });

  it('does not contain mojibake tokens in key labels', () => {
    const source = JSON.stringify(chatCopy);
    const mojibakeTokens = ['閸', '鍒', '鎴', '锛', '娑', '鏄'];
    mojibakeTokens.forEach((token) => {
      expect(source).not.toContain(token);
    });
  });
});
