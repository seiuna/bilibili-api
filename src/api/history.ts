import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface HistoryItem {
  title: string;
  cover: string;
  uri: string;
  history: { oid: number; epid?: number; bvid: string; page: number; cid: number; part: string; business: string; dt: number };
  videos: number;
  author_name: string;
  author_face: string;
  author_mid: number;
  view_at: number;
  progress: number;
  badge: string;
  show_title: string;
  duration: number;
  kid: number;
  tag_name: string;
  live_status: number;
  is_fav: boolean;
}

export interface HistoryData {
  cursor: { max: number; view_at: number; business: string; ps: number };
  tab: { type: string; name: string }[];
  list: HistoryItem[];
}

export interface ToViewVideo {
  aid: number;
  bvid: string;
  videos: number;
  tid: number;
  tname: string;
  copyright: number;
  pic: string;
  title: string;
  pubdate: number;
  ctime: number;
  desc: string;
  duration: number;
  rights: Record<string, number>;
  owner: { mid: number; name: string; face: string };
  stat: Record<string, number>;
  cid: number;
  progress: number;
  add_at: number;
}

export class HistoryAPI {
  /** 获取历史记录 �?async generator 翻页 */
  static async *history(
    client: BiliClient<any>,
    ps = 20,
    type: 'all' | 'archive' | 'live' | 'article' = 'all',
  ): AsyncGenerator<HistoryItem> {
    let max: number | undefined;
    let viewAt: number | undefined;

    while (true) {
      const params = new URLSearchParams({ ps: String(Math.min(ps, 30)), type });
      if (max !== undefined) params.set('max', String(max));
      if (viewAt !== undefined) params.set('view_at', String(viewAt));

      const data = await client.request<BiliApiResponse<HistoryData>>(
        `https://api.bilibili.com/x/web-interface/history/cursor?${params}`,
      );

      if (data.code !== 0 || !data.data.list?.length) break;

      for (const item of data.data.list) yield item;

      if (!data.data.cursor.max) break;
      max = data.data.cursor.max;
      viewAt = data.data.cursor.view_at;
    }
  }

  /** 清理历史记录 */
  static async clearHistory(
    client: BiliClient<any>,
    kid?: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ csrf });
    if (kid !== undefined) body.set('kid', String(kid));
    return client.request('https://api.bilibili.com/x/v2/history/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 获取稍后再看视频列表 */
  static async getToViewList(client: BiliClient<any>): Promise<BiliApiResponse<{ count: number; list: ToViewVideo[] }>> {
    return client.request('https://api.bilibili.com/x/v2/history/toview');
  }

  /** 添加稍后再看 */
  static async addToView(
    client: BiliClient<any>,
    aid?: number,
    bvid?: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ csrf });
    if (aid) body.set('aid', String(aid));
    if (bvid) body.set('bvid', bvid);
    return client.request('https://api.bilibili.com/x/v2/history/toview/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 删除稍后再看 */
  static async removeFromView(
    client: BiliClient<any>,
    aid: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/history/toview/del', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ aid: String(aid), csrf }).toString(),
    });
  }

  /** 清空稍后再看 */
  static async clearToView(client: BiliClient<any>): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/v2/history/toview/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf }).toString(),
    });
  }
}
