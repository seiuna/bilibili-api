import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';
import type { RecommendVideo } from './video.js';

export interface RankingData {
  note: string;
  list: (RecommendVideo & { score: number })[];
}

export interface PreciousVideosData {
  title: string;
  media_id: number;
  explain: string;
  list: (RecommendVideo & { achievement?: string; rcmd_reason?: string })[];
}

export class RankingAPI {
  /** 获取热门视频 */
  static async getPopular(
    client: BiliClient<any>,
    pn = 1,
    ps = 20,
  ): Promise<BiliApiResponse<{ list: RecommendVideo[]; no_more: boolean }>> {
    return client.request(`https://api.bilibili.com/x/web-interface/popular?pn=${pn}&ps=${ps}`);
  }

  /** 获取视频排行�?*/
  static async getRanking(
    client: BiliClient<any>,
    rid = 0,
    type: 'all' | 'rokkie' | 'origin' = 'all',
  ): Promise<BiliApiResponse<RankingData>> {
    return client.request(
      `https://api.bilibili.com/x/web-interface/ranking/v2?rid=${rid}&type=${type}`,
      { wbi: true },
    );
  }

  /** 获取入站必刷视频 */
  static async getPreciousVideos(
    client: BiliClient<any>,
  ): Promise<BiliApiResponse<PreciousVideosData>> {
    return client.request('https://api.bilibili.com/x/web-interface/popular/precious');
  }
}
