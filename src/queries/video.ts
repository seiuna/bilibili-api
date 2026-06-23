import type { BiliClient } from '../client.js';
import type { RequestContext, BiliApiResponse } from '../types.js';
import { CommentQuery } from './comment.js';
import { VideoResult } from './results.js';

// ==========================================
// VideoQuery — 视频信息查询
// ==========================================

/** 视频详情（对齐真实 API 返回） */
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
  owner: {
    mid: number;
    name: string;
    face: string;
  };
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
  rights: {
    bp: number; elec: number; download: number; movie: number; pay: number;
    hd5: number; no_reprint: number; autoplay: number; ugc_pay: number;
    is_cooperation: number; ugc_pay_preview: number; no_background: number;
    clean_mode: number; is_stein_gate: number; is_360: number;
    no_share: number; arc_pay: number; free_watch: number;
  };
  argue_info?: { argue_msg: string; argue_type: number; argue_link: string };
  premiere?: unknown;
  teenage_mode?: number;
  is_chargeable_season?: boolean;
  is_story?: boolean;
  is_upower_exclusive?: boolean;
  is_upower_play?: boolean;
  is_upower_preview?: boolean;
  enable_vt?: number;
  vt_display?: string;
  is_upower_exclusive_with_qa?: boolean;
  no_cache?: boolean;
  user_garb?: { url_image_ani_cut: string };
  honor_reply?: Record<string, unknown>;
  like_icon?: string;
  need_jump_bv?: boolean;
  disable_show_up_info?: boolean;
  is_story_play?: number;
  is_view_self?: boolean;
  is_season_display?: boolean;
}

export class VideoQuery {
  constructor(
    private client: BiliClient,
    private ctx: RequestContext,
  ) {}

  getComment(): CommentQuery {
    return new CommentQuery(this.client, {
      ...this.ctx,
      oid: this.ctx.vid ? undefined : this.ctx.oid,
    });
  }

  async fetch(): Promise<VideoResult> {
    const vid = this.ctx.vid;
    if (!vid) {
      throw new Error('VideoQuery.fetch(): 缺少 vid');
    }
    const raw = await this.client.request<BiliApiResponse<VideoInfo>>(
      `https://api.bilibili.com/x/web-interface/view?bvid=${vid}`,
    );
    return new VideoResult(this.client, raw);
  }
}
