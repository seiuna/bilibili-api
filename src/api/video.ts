import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

// ---- 类型定义 ----

export interface VideoInfo {
  bvid: string;
  aid: number;
  videos: number;
  tid: number;
  tid_v2?: number;
  tname: string;
  tname_v2?: string;
  copyright: number;
  pic: string;
  title: string;
  pubdate: number;
  ctime: number;
  desc: string;
  desc_v2?: unknown[];
  state: number;
  duration: number;
  cid: number;
  owner: { mid: number; name: string; face: string };
  stat: {
    aid?: number;
    view: number;
    danmaku: number;
    reply: number;
    favorite: number;
    coin: number;
    share: number;
    now_rank?: number;
    his_rank?: number;
    like: number;
    dislike?: number;
    evaluation?: string;
    vt?: number;
  };
  dynamic: string;
  dimension: { width: number; height: number; rotate: number };
  pages: { cid: number; page: number; part: string; duration: number; dimension?: unknown }[];
  subtitle: { allow_submit: boolean; list: unknown[] };
  rights: Record<string, number>;
  argue_info?: { argue_msg: string; argue_type: number; argue_link: string };
  ugc_season?: unknown;
  staff?: unknown[];
  [key: string]: unknown;
}

export interface VideoStat {
  aid: number;
  bvid: string;
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  now_rank: number;
  his_rank: number;
  like: number;
  dislike: number;
  no_reprint: number;
  copyright: number;
  argue_msg: string;
  evaluation: string;
}

export interface PlayUrlData {
  quality: number;
  format: string;
  timelength: number;
  accept_format: string;
  accept_description: string[];
  accept_quality: number[];
  durl?: { order: number; length: number; size: number; url: string; backup_url: string[] }[];
  dash?: {
    video: { id: number; codecid: number; bandwidth: number; baseUrl: string; backupUrl: string[] }[];
    audio: { id: number; bandwidth: number; baseUrl: string; backupUrl: string[] }[];
  };
  support_formats: { quality: number; format: string; new_description: string; codecs: string[] }[];
  last_play_time?: number;
  last_play_cid?: number;
}

export interface OnlineCount {
  total: string;
  count: string;
  show_switch: { total: boolean; count: boolean };
}

export interface AiSummary {
  code: number;
  stid: string;
  like_num: number;
  dislike_num: number;
  model_result: {
    result_type: number;
    summary: string;
    outline: { title: string; timestamp: number; part_outline: { timestamp: number; content: string }[] }[];
    subtitle: { part_subtitle: { content: string; start_timestamp: number; end_timestamp: number }[]; timestamp: number; title: string }[];
  };
}

export interface VideoSnapshot {
  pvdata: string;
  img_x_len: number;
  img_y_len: number;
  img_x_size: number;
  img_y_size: number;
  image: string[];
  index: number[];
}

export interface PbpData {
  step_sec: number;
  tagstr: string;
  events: { default: number[] };
  debug: string;
}

export interface VideoTag {
  tag_id: number;
  tag_name: string;
  music_id?: string;
  tag_type?: string;
  jump_url?: string;
}

export interface RecommendVideo {
  aid: number;
  bvid: string;
  title: string;
  pic: string;
  tid: number;
  tname: string;
  copyright: number;
  duration: number;
  owner: { mid: number; name: string; face: string };
  stat: Record<string, number>;
  cid: number;
  dimension: { width: number; height: number; rotate: number };
}

// ---- API 方法 ----

export class VideoAPI {
  /** 获取视频基本信息 */
  static async getInfo(client: BiliClient<any>, bvid?: string, aid?: number): Promise<BiliApiResponse<VideoInfo>> {
    const params = new URLSearchParams();
    if (bvid) params.set('bvid', bvid);
    if (aid) params.set('aid', String(aid));
    return client.request(`https://api.bilibili.com/x/web-interface/wbi/view?${params}`, { wbi: true });
  }

  /** 通过 aid 获取视频信息 */
  static async getInfoByAid(client: BiliClient<any>, aid: number): Promise<BiliApiResponse<VideoInfo>> {
    return client.request(`https://api.bilibili.com/x/web-interface/view?aid=${aid}`);
  }

  /** 获取视频状态数 */
  static async getStat(client: BiliClient<any>, bvid?: string, aid?: number): Promise<BiliApiResponse<VideoStat>> {
    const params = new URLSearchParams();
    if (bvid) params.set('bvid', bvid);
    if (aid) params.set('aid', String(aid));
    return client.request(`https://api.bilibili.com/x/web-interface/archive/stat?${params}`);
  }

  /** 获取视频流播�?& 下载地址 */
  static async getPlayUrl(
    client: BiliClient<any>,
    cid: number,
    options: {
      avid?: number;
      bvid?: string;
      qn?: number;
      fnval?: number;
      fnver?: number;
      fourk?: 0 | 1;
      platform?: string;
    } = {},
  ): Promise<BiliApiResponse<PlayUrlData>> {
    const params = new URLSearchParams({ cid: String(cid) });
    if (options.avid) params.set('avid', String(options.avid));
    if (options.bvid) params.set('bvid', options.bvid);
    if (options.qn !== undefined) params.set('qn', String(options.qn));
    if (options.fnval !== undefined) params.set('fnval', String(options.fnval));
    if (options.fnver !== undefined) params.set('fnver', String(options.fnver));
    if (options.fourk !== undefined) params.set('fourk', String(options.fourk));
    if (options.platform) params.set('platform', options.platform);
    return client.request(`https://api.bilibili.com/x/player/wbi/playurl?${params}`, { wbi: true });
  }

  /** 获取视频在线人数 */
  static async getOnlineCount(
    client: BiliClient<any>,
    cid: number,
    aid?: number,
    bvid?: string,
  ): Promise<BiliApiResponse<OnlineCount>> {
    const params = new URLSearchParams({ cid: String(cid) });
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    return client.request(`https://api.bilibili.com/x/player/online/total?${params}`);
  }

  /** 获取视频 AI 摘要 */
  static async getAiSummary(
    client: BiliClient<any>,
    cid: number,
    aid?: number,
    bvid?: string,
    upMid?: number,
  ): Promise<BiliApiResponse<AiSummary>> {
    const params = new URLSearchParams({ cid: String(cid) });
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    if (upMid) params.set('up_mid', String(upMid));
    return client.request(`https://api.bilibili.com/x/web-interface/view/conclusion/get?${params}`, { wbi: true });
  }

  /** 获取视频快照 / 高能进度�?*/
  static async getSnapshot(
    client: BiliClient<any>,
    cid: number,
    aid?: number,
    bvid?: string,
    index = 0,
  ): Promise<BiliApiResponse<VideoSnapshot>> {
    const params = new URLSearchParams({ cid: String(cid), index: String(index) });
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    return client.request(`https://api.bilibili.com/x/player/videoshot?${params}`);
  }

  /** 获取高能进度条数�?*/
  static async getPbp(
    client: BiliClient<any>,
    cid: number,
    aid?: number,
    bvid?: string,
  ): Promise<PbpData> {
    const params = new URLSearchParams({ cid: String(cid) });
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    return client.request(`https://bvc.bilivideo.com/pbp/data?${params}`);
  }

  /** 获取视频推荐列表 */
  static async getRecommend(
    client: BiliClient<any>,
    aid?: number,
    bvid?: string,
  ): Promise<BiliApiResponse<RecommendVideo[]>> {
    const params = new URLSearchParams();
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    return client.request(`https://api.bilibili.com/x/web-interface/archive/related?${params}`);
  }

  /** 获取视频 TAG */
  static async getTags(
    client: BiliClient<any>,
    aid?: number,
    bvid?: string,
    cid?: number,
  ): Promise<BiliApiResponse<VideoTag[]>> {
    const params = new URLSearchParams();
    if (aid) params.set('aid', String(aid));
    if (bvid) params.set('bvid', bvid);
    if (cid) params.set('cid', String(cid));
    return client.request(`https://api.bilibili.com/x/web-interface/view/detail/tag?${params}`);
  }

  // ---- 视频互动操作 ----

  /** 点赞视频 */
  static async like(
    client: BiliClient<any>,
    aid: number,
    like: 1 | 2 = 1,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/web-interface/archive/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ aid: String(aid), like: String(like), csrf }).toString(),
    });
  }

  /** 判断是否点赞 */
  static async hasLiked(client: BiliClient<any>, aid: number): Promise<BiliApiResponse<number>> {
    return client.request(`https://api.bilibili.com/x/web-interface/archive/has/like?aid=${aid}`);
  }

  /** 投币视频 */
  static async coin(
    client: BiliClient<any>,
    aid: number,
    multiply = 1,
    selectLike = 0,
  ): Promise<BiliApiResponse<{ like: boolean }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/web-interface/coin/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        aid: String(aid),
        multiply: String(multiply),
        select_like: String(selectLike),
        csrf,
      }).toString(),
    });
  }

  /** 判断是否投币 */
  static async hasCoined(client: BiliClient<any>, aid: number): Promise<BiliApiResponse<{ multiply: number }>> {
    return client.request(`https://api.bilibili.com/x/web-interface/archive/coins?aid=${aid}`);
  }

  /** 收藏视频 */
  static async favorite(
    client: BiliClient<any>,
    rid: number,
    addMediaIds: string,
    delMediaIds = '',
  ): Promise<BiliApiResponse<{ prompt: boolean }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/medialist/gateway/coll/resource/deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        rid: String(rid),
        type: '2',
        add_media_ids: addMediaIds,
        del_media_ids: delMediaIds,
        csrf,
      }).toString(),
    });
  }

  /** 判断是否收藏 */
  static async hasFavorited(client: BiliClient<any>, aid: number): Promise<BiliApiResponse<{ favoured: boolean }>> {
    return client.request(`https://api.bilibili.com/x/v2/fav/video/favoured?aid=${aid}`);
  }

  /** 一键三�?*/
  static async triple(
    client: BiliClient<any>,
    aid: number,
  ): Promise<BiliApiResponse<{ like: boolean; coin: boolean; fav: boolean; multiply: number }>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/web-interface/archive/like/triple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ aid: String(aid), csrf }).toString(),
    });
  }

  /** 分享视频 */
  static async share(client: BiliClient<any>, aid: number): Promise<BiliApiResponse<number>> {
    const csrf = client.config.getCsrf();
    return client.request('https://api.bilibili.com/x/web-interface/share/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ aid: String(aid), csrf }).toString(),
    });
  }
}
