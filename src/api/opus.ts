import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface OpusDetail {
  item: {
    basic: {
      comment_id_str: string;
      comment_type: number;
      like_icon: unknown;
      rid_str: string;
      title: string;
      uid: number;
    };
    id_str: string;
    modules: unknown[];
    type: string;
    visible: boolean;
  };
}

export interface OpusSpaceItem {
  content: string;
  cover: { height: number; url: string; width: number };
  jump_url: string;
  opus_id: string;
  stat: { like: number; view?: number };
}

export interface OpusSpaceData {
  has_more: boolean;
  items: OpusSpaceItem[];
  offset: string;
  update_num: number;
}

export class OpusAPI {
  /** 获取图文详细 */
  static async getDetail(
    client: BiliClient<any>,
    id: number | string,
  features = 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote',
  ): Promise<BiliApiResponse<OpusDetail>> {
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/detail?id=${id}&features=${features}`,
    );
  }

  /** 获取空间图文列表 */
  static async getSpace(
    client: BiliClient<any>,
    hostMid: number,
    offset?: string,
    type: 'all' | 'article' | 'dynamic' = 'all',
  ): Promise<BiliApiResponse<OpusSpaceData>> {
    const params = new URLSearchParams({ host_mid: String(hostMid), type });
    if (offset) params.set('offset', offset);
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/opus/feed/space?${params}`,
      { wbi: true },
    );
  }
}
