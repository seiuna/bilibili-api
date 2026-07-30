import type { BiliApiResponse } from '../core/types.js';
import { BiliClient } from '../index.js';

export interface ArticleInfo {
  like: number;
  attention: boolean;
  favorite: boolean;
  coin: number;
  stats: {
    view: number;
    favorite: number;
    like: number;
    dislike: number;
    reply: number;
    share: number;
    coin: number;
    dynamic: number;
  };
  title: string;
  banner_url: string;
  mid: number;
  author_name: string;
  image_urls: string[];
  origin_image_urls: string[];
  type: number;
  pre: number;
  next: number;
  in_list: boolean;
}

export interface ArticleView {
  id: number;
  title: string;
  content: string;
  summary: string;
  author: { mid: number; name: string; face: string; level_info?: unknown };
  banner_url: string;
  categories: { id: number; name: string; parent_id: number }[];
  category: { id: number; name: string; parent_id: number };
  image_urls: string[];
  origin_image_urls: string[];
  list: unknown;
  stats: {
    view: number;
    favorite: number;
    like: number;
    dislike: number;
    reply: number;
    share: number;
    coin: number;
    dynamic: number;
  };
  tags: { name: string; tid: number }[];
  original: number;
  reprint: number;
  publish_time: number;
  ctime: number;
  mtime: number;
  words: number;
  type: number;
  cover_avid?: number;
  dyn_id_str?: string;
  opus?: unknown;
}

export interface ArticleCollection {
  list: {
    id: number;
    mid: number;
    name: string;
    image_url: string;
    update_time: number;
    ctime: number;
    publish_time: number;
    summary: string;
    words: number;
    read: number;
    articles_count: number;
    state: number;
  };
  articles: {
    id: number;
    title: string;
    publish_time: number;
    words: number;
    image_urls: string[];
    category: { id: number; parent_id: number; name: string };
    categories: { id: number; parent_id: number; name: string }[];
    summary: string;
    stats: Record<string, number>;
    like_state: number;
  }[];
  author: { mid: number; name: string; face: string };
  attention: boolean;
  last: number;
}

export class ArticleAPI {
  /** 获取专栏基本信息 */
  static async getInfo(client: BiliClient<any>, cvid: number): Promise<BiliApiResponse<ArticleInfo>> {
    return client.request(`https://api.bilibili.com/x/article/viewinfo?id=${cvid}`);
  }

  /** 获取专栏内容 */
  static async getView(client: BiliClient<any>, cvid: number): Promise<BiliApiResponse<ArticleView>> {
    return client.request(`https://api.bilibili.com/x/article/view?id=${cvid}`);
  }

  /** 点赞专栏 */
  static async like(
    client: BiliClient<any>,
    cvid: number,
    type: 1 | 2 = 1,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/article/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id: String(cvid), type: String(type), csrf }).toString(),
    });
  }

  /** 投币专栏 */
  static async coin(
    client: BiliClient<any>,
    cvid: number,
    upid: number,
    multiply = 1,
  ): Promise<BiliApiResponse<{ like: boolean }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/web-interface/coin/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        aid: String(cvid),
        upid: String(upid),
        multiply: String(multiply),
        avtype: '2',
        csrf,
      }).toString(),
    });
  }

  /** 收藏专栏 */
  static async favorite(
    client: BiliClient<any>,
    cvid: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/article/favorites/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id: String(cvid), csrf }).toString(),
    });
  }

  /** 获取文集基本信息 */
  static async getCollection(
    client: BiliClient<any>,
    rlid: number,
  ): Promise<BiliApiResponse<ArticleCollection>> {
    return client.request(`https://api.bilibili.com/x/article/list/web/articles?id=${rlid}`);
  }

  /** 卡片信息（批量查�?AV/BV/CV/LV�?*/
  static async getCards(
    client: BiliClient<any>,
    ids: string,
  ): Promise<BiliApiResponse<Record<string, unknown>>> {
    return client.request(`https://api.bilibili.com/x/article/cards?ids=${ids}`);
  }
}
