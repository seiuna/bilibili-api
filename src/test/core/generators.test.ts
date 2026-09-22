import { describe, expect, it } from 'vitest';
import { BiliClient, type HasToken } from '../../core/client.js';
import { HistoryItemEntity } from '../../entities/HistoryItemEntity.js';
import { AtNotifyItem, ReplyNotifyItem } from '../../entities/NotifyItem.js';

describe('BiliClient Async Generator Test', () => {
  it('getHistory、atFeed、replyFeed 应直接返回 AsyncGenerator，支持 for await...of 迭代', async () => {
    const mockFetch = async (url: string) => {
      if (url.includes('/history/cursor')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            cursor: { max: 0, view_at: 0, ps: 20 },
            list: [{ title: '测试历史视频', progress: 100, kid: 'archive_80433022', oid: 80433022, business: 'archive' }],
          },
        }));
      }
      if (url.includes('/x/msgfeed/at')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            cursor: { is_end: true, id: 0, time: 0 },
            items: [{
              id: 1,
              user: { mid: 1001, nickname: '用户A', avatar: '' },
              item: { business_id: 1, subject_id: 10, root_id: 0, source_id: 20, source_content: 'hello', uri: '' },
              at_time: 1700000000,
            }],
          },
        }));
      }
      if (url.includes('/x/msgfeed/reply')) {
        return new Response(JSON.stringify({
          code: 0,
          data: {
            cursor: { is_end: true, id: 0, time: 0 },
            items: [{
              id: 2,
              user: { mid: 1002, nickname: '用户B', avatar: '' },
              item: { business_id: 1, subject_id: 10, root_id: 0, source_id: 30, source_content: 'reply', uri: '' },
              reply_time: 1700000000,
            }],
            last_view_at: 0,
          },
        }));
      }
      return new Response(JSON.stringify({ code: 0, data: {} }));
    };

    const client = new BiliClient(undefined, mockFetch as typeof fetch) as BiliClient<HasToken>;

    // 1. 验证 getHistory 返回 AsyncGenerator，不是 Promise
    const historyGen = client.getHistory(20);
    expect(historyGen instanceof Promise).toBe(false);
    expect(Symbol.asyncIterator in historyGen).toBe(true);

    const historyItems: HistoryItemEntity[] = [];
    for await (const item of historyGen) {
      historyItems.push(item);
      break;
    }
    expect(historyItems).toHaveLength(1);
    expect(historyItems[0]).toBeInstanceOf(HistoryItemEntity);
    expect(historyItems[0].title).toBe('测试历史视频');

    // 2. 验证 atFeed 返回 AsyncGenerator，不是 Promise
    const atGen = client.atFeed();
    expect(atGen instanceof Promise).toBe(false);
    expect(Symbol.asyncIterator in atGen).toBe(true);

    const atItems: AtNotifyItem[] = [];
    for await (const item of atGen) {
      atItems.push(item);
      break;
    }
    expect(atItems).toHaveLength(1);
    expect(atItems[0]).toBeInstanceOf(AtNotifyItem);
    expect(atItems[0].authorName).toBe('用户A');

    // 3. 验证 replyFeed 返回 AsyncGenerator，不是 Promise
    const replyGen = client.replyFeed();
    expect(replyGen instanceof Promise).toBe(false);
    expect(Symbol.asyncIterator in replyGen).toBe(true);

    const replyItems: ReplyNotifyItem[] = [];
    for await (const item of replyGen) {
      replyItems.push(item);
      break;
    }
    expect(replyItems).toHaveLength(1);
    expect(replyItems[0]).toBeInstanceOf(ReplyNotifyItem);
    expect(replyItems[0].authorName).toBe('用户B');
  });
});
