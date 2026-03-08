import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('App lazy tab loading', () => {
  it('lazy-loads the heavier chat, room chat, and trash tabs', () => {
    const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');

    expect(source).toContain("lazy(() => import('./components/ChatAssistantTab'))");
    expect(source).toContain("lazy(() => import('./chat/EmbeddedChatRoomTab'))");
    expect(source).toContain("lazy(() => import('./components/TrashTab'))");
    expect(source).toContain('<Suspense');
  });

  it('moves recycle bin UI into a dedicated component', () => {
    const source = readFileSync(new URL('./components/TrashTab.jsx', import.meta.url), 'utf8');

    expect(source).toContain('回收站');
    expect(source).toContain('进入回收站');
    expect(source).toContain('当前区域受密码保护，仅本次进入有效。');
  });

  it('moves AI assistant UI into a dedicated component', () => {
    const source = readFileSync(new URL('./components/ChatAssistantTab.jsx', import.meta.url), 'utf8');

    expect(source).toContain('AI文字助手');
    expect(source).toContain('前置提示词 ID（输入短ID或完整ID）');
    expect(source).toContain('提问...');
  });

  it('moves AI assistant state into a dedicated hook', () => {
    const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8');
    const hookUrl = new URL('./chat/useChatAssistant.js', import.meta.url);

    expect(appSource).toContain("import useChatAssistant from './chat/useChatAssistant';");
    expect(appSource).not.toContain("const [chatProvider, setChatProvider] = useState('deepseek');");
    expect(existsSync(hookUrl)).toBe(true);

    const hookSource = readFileSync(hookUrl, 'utf8');
    expect(hookSource).toContain("const [chatProvider, setChatProvider] = useState('deepseek');");
    expect(hookSource).toContain('const useChatAssistant =');
    expect(hookSource).toContain('const useChatStream =');
  });
});
