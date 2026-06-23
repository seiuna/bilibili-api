import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type {
  UnreadCount,
  ReplyFeedData,
  AtFeedData,
} from './types.js';
import { ReplyFeedItem, AtFeedItem } from './notify-results.js';

// ==========================================
// 消息通知 API
// ==========================================

export class NotifyAPI {
  constructor(private client: BiliClient) {}

  /**
   * 获取未读消息数
   */
  async unreadCount(): Promise<BiliApiResponse<UnreadCount>> {
    return this.client.request(
      'https://api.vc.bilibili.com/x/im/web/msgfeed/unread',
    );
  }

  /**
   * 获取"回复我的"信息 — async generator 翻页
   * 每项为 ReplyFeedItem，提供 .getComments() 翻页 + getter 方法
   */
  async *replyFeed(): AsyncGenerator<ReplyFeedItem> {
    let cursorId = 0;
    let cursorTime = 0;
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams();
      if (cursorId > 0) params.set('id', String(cursorId));
      if (cursorTime > 0) params.set('reply_time', String(cursorTime));

      const url =
        `https://api.bilibili.com/x/msgfeed/reply?${params.toString()}`;

      const data = await this.client.request<BiliApiResponse<ReplyFeedData>>(url);

      if (data.code !== 0) break;

      const { cursor, items } = data.data;

      for (const item of items) {
        yield new ReplyFeedItem(this.client, item);
      }

      isEnd = cursor.is_end;
      cursorId = cursor.id;
      cursorTime = cursor.time;

      if (items.length === 0) break;
    }
  }

  /**
   * 获取"@我的"信息 — async generator 翻页
   * 每项为 AtFeedItem，提供 .getComments() 翻页 + getter 方法
   */
  async *atFeed(): AsyncGenerator<AtFeedItem> {
    let cursorId = 0;
    let cursorTime = 0;
    let isEnd = false;

    while (!isEnd) {
      const params = new URLSearchParams({
        platform: 'web',
        build: '0',
        mobi_app: 'web',
      });
      if (cursorId > 0) params.set('id', String(cursorId));
      if (cursorTime > 0) params.set('reply_time', String(cursorTime));

      const url =
        `https://api.bilibili.com/x/msgfeed/at?${params.toString()}`;

      const data = await this.client.request<BiliApiResponse<AtFeedData>>(url);

      if (data.code !== 0) break;

      const { cursor, items } = data.data;

      for (const item of items) {
        yield new AtFeedItem(this.client, item);
      }

      isEnd = cursor.is_end;
      cursorId = cursor.id;
      cursorTime = cursor.time;

      if (items.length === 0) break;
    }
  }
}
