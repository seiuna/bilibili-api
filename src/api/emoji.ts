import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface EmoteItem {
  id: number;
  package_id: number;
  text: string;
  url: string;
  mtime: number;
  type: number;
  attr: number;
  meta: { size: number; alias?: string };
}

export interface EmotePackage {
  id: number;
  text: string;
  url: string;
  mtime: number;
  type: number;
  attr: number;
  meta: { size: number; item_id: number };
  emote: EmoteItem[];
}

export class EmojiAPI {
  /** 获取表情及表情包信息 */
  static async getPanel(
    client: BiliClient<any>,
    business: 'reply' | 'dynamic' = 'reply',
  ): Promise<BiliApiResponse<{ packages: EmotePackage[] }>> {
    return client.request(`https://api.bilibili.com/x/emote/user/panel/web?business=${business}`);
  }

  /** 添加表情�?*/
  static async addPackage(
    client: BiliClient<any>,
    packageId: number,
    business: 'reply' | 'dynamic' = 'reply',
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/emote/package/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ package_id: String(packageId), business, csrf }).toString(),
    });
  }

  /** 移除表情�?*/
  static async removePackage(
    client: BiliClient<any>,
    packageId: number,
    business: 'reply' | 'dynamic' = 'reply',
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/emote/package/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ package_id: String(packageId), business, csrf }).toString(),
    });
  }
}
