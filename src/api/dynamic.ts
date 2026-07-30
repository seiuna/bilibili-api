import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface DynamicDetail {
  item: {
    basic: {
      comment_id_str: string;
      comment_type: number;
      rid_str: string;
      title?: string;
      uid: number;
    };
    id_str: string;
    modules: unknown[];
    type: string;
    visible: boolean;
  };
}

export interface DynamicFeedItem {
  basic: {
    comment_id_str: string;
    comment_type: number;
    jump_url?: string;
    rid_str: string;
  };
  id_str: string;
  modules: {
    module_author: unknown;
    module_dynamic: unknown;
    module_interaction?: unknown;
  };
}

export interface DynamicSpaceData {
  has_more: boolean;
  items: DynamicFeedItem[];
}

export class DynamicAPI {
  /** 获取动态详�?*/
  static async getDetail(client: BiliClient<any>, id: string): Promise<BiliApiResponse<DynamicDetail>> {
    const features = 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote';
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${id}&features=${features}`,
    );
  }

  /** 获取用户空间动�?*/
  static async getSpace(
    client: BiliClient<any>,
    hostMid: number,
    offset?: string,
  ): Promise<BiliApiResponse<DynamicSpaceData>> {
    const params = new URLSearchParams({ host_mid: String(hostMid) });
    if (offset) params.set('offset', offset);
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${params}`,
    );
  }

  /** 点赞动�?*/
  static async like(
    client: BiliClient<any>,
    dynIdStr: string,
    up: 0 | 1 | 2 = 1,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/dyn/thumb?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_id_str: dynIdStr, up }),
    });
  }

  /** 删除动�?*/
  static async delete(
    client: BiliClient<any>,
    dynamicId: number,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: new URLSearchParams({
        dynamic_id: String(dynamicId),
        csrf_token: csrf,
        csrf,
      }).toString(),
    });
  }

  /** 设置置顶动�?*/
  static async setTop(
    client: BiliClient<any>,
    dynStr: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/space/set_top?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_str: dynStr }),
    });
  }

  /** 取消置顶动�?*/
  static async removeTop(
    client: BiliClient<any>,
    dynStr: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/space/rm_top?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_str: dynStr }),
    });
  }
}
