import { assertOk, type BiliClient } from '../core/client.js';
import type { BiliApiResponse } from '../core/types.js';
import type { HistoryItemEntity } from '../entities/HistoryItemEntity.js';
import type { HistoryDataEntity } from '../entities/HistoryDataEntity.js';
import type { ToViewVideoEntity } from '../entities/ToViewVideoEntity.js';

/**
 * 观看历史条目原始数据
 *
 * 实体包装见 {@link HistoryItemEntity}。
 */
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

/**
 * 观看历史分页原始数据
 *
 * 实体包装见 {@link HistoryDataEntity}。
 */
export interface HistoryData {
  cursor: { max: number; view_at: number; business: string; ps: number };
  tab: { type: string; name: string }[];
  list: HistoryItem[];
}

/**
 * 稍后再看视频原始数据
 *
 * 实体包装见 {@link ToViewVideoEntity}。
 */
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
  /** 获取单页历史记录（游标分页） */
  static async getHistory(
    client: BiliClient<any>,
    ps = 20,
    type: 'all' | 'archive' | 'live' | 'article' = 'all',
    max?: number,
    viewAt?: number,
    business?: string,
  ): Promise<BiliApiResponse<HistoryData>> {
    const params = new URLSearchParams({ ps: String(Math.min(ps, 30)), type });
    if (max !== undefined) params.set('max', String(max));
    if (viewAt !== undefined) params.set('view_at', String(viewAt));
    if (business !== undefined) params.set('business', business);
    return client.request<BiliApiResponse<HistoryData>>(
      `https://api.bilibili.com/x/web-interface/history/cursor?${params}`,
    );
  }

  /** 获取历史记录 — async generator 翻页 */
  static async *history(
    client: BiliClient<any>,
    ps = 20,
    type: 'all' | 'archive' | 'live' | 'article' = 'all',
  ): AsyncGenerator<HistoryItem> {
    let max: number | undefined;
    let viewAt: number | undefined;
    let business: string | undefined;

    while (true) {
      const data = assertOk(await this.getHistory(client, ps, type, max, viewAt, business));
      if (!data.data?.list?.length) break;

      for (const item of data.data.list) yield item;

      if (!data.data.cursor?.max) break;
      max = data.data.cursor.max;
      viewAt = data.data.cursor.view_at;
      business = data.data.cursor.business;
    }
  }

  /** 清空全部历史。旧版 kid 参数已禁止，删除单条请用 deleteHistory。 */
  static async clearHistory(
    client: BiliClient<any>,
    kid?: never,
  ): Promise<BiliApiResponse<unknown>> {
    // Runtime guard also protects JavaScript and callers compiled against older declarations.
    if (kid !== undefined) {
      throw new TypeError('clearHistory clears ALL history; use deleteHistory(client, business_id) for one entry');
    }
    const csrf = client.config.getCsrf();
    const body = new URLSearchParams({ csrf });
    return client.request('https://api.bilibili.com/x/v2/history/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  /** 删除单条历史，kid 格式为 archive_avid / live_roomid / article_cvid / pgc_ssid / article-list_rlid。 */
  static async deleteHistory(
    client: BiliClient<any>,
    kid: string,
  ): Promise<BiliApiResponse<unknown>> {
    if (!/^(?:archive|live|article|pgc|article-list)_[1-9]\d*$/.test(kid)) {
      throw new TypeError('kid must contain a supported business prefix and a positive decimal ID');
    }
    return client.request('https://api.bilibili.com/x/v2/history/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ kid, csrf: client.config.getCsrf() }).toString(),
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
