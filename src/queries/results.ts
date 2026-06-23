import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type { VideoInfo } from './video.js';
import type { UserCard } from './user.js';
import type { ReplyEntry } from '../api/types.js';
import type { ReplyAddResult } from '../api/types.js';
import { CommentQuery } from './comment.js';
import { UserQuery } from './user.js';
import { VideoQuery } from './video.js';
import { CommentArea } from '../api/comment-area.js';
import { ReplyReportReason } from '../api/types.js';
import type { UploadImageResult } from '../api/upload.js';

// ==========================================
// 二次封装结果对象
// ==========================================

/** 视频详情结果 */
export class VideoResult implements VideoInfo {
  bvid!: string; aid!: number; videos!: number; tid!: number; tid_v2?: number;
  tname!: string; tname_v2?: string; copyright!: number; pic!: string;
  title!: string; pubdate!: number; ctime!: number; desc!: string;
  desc_v2?: unknown[]; state!: number; duration!: number; cid!: number;
  owner!: VideoInfo['owner']; stat!: VideoInfo['stat']; dynamic!: string;
  dimension!: VideoInfo['dimension']; pages!: VideoInfo['pages'];
  subtitle!: VideoInfo['subtitle']; rights!: VideoInfo['rights'];
  argue_info?: VideoInfo['argue_info']; premiere?: unknown; teenage_mode?: number;
  is_chargeable_season?: boolean; is_story?: boolean;
  is_upower_exclusive?: boolean; is_upower_play?: boolean;
  is_upower_preview?: boolean; enable_vt?: number; vt_display?: string;
  is_upower_exclusive_with_qa?: boolean; no_cache?: boolean;
  user_garb?: VideoInfo['user_garb']; honor_reply?: VideoInfo['honor_reply'];
  like_icon?: string; need_jump_bv?: boolean; disable_show_up_info?: boolean;
  is_story_play?: number; is_view_self?: boolean; is_season_display?: boolean;

  raw!: BiliApiResponse<VideoInfo>;

  constructor(private client: BiliClient, raw: BiliApiResponse<VideoInfo>) {
    Object.assign(this, raw.data);
    this.raw = raw;
  }

  /** 评论区对象 — type=1 视频评论 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.aid, 1);
  }

  /** 获取 UP 主信息 */
  async getUser(): Promise<UserResult> {
    return new UserQuery(this.client, { mid: this.owner.mid }).fetch();
  }

  /** 获取评论查询（原始 fetch） */
  getComment(): CommentQuery {
    return new CommentQuery(this.client, { oid: this.aid });
  }

  getUpVideos(): VideoQuery {
    return new VideoQuery(this.client, { vid: this.bvid });
  }

  // ---- 评论区快捷操作（委托给 CommentArea） ----
  async postComment(message: string, pictures?: UploadImageResult[]): Promise<BiliApiResponse<ReplyAddResult>> {
    return this.commentArea().add(message, 0, 0, pictures);
  }
  async replyToComment(parentRpid: number, message: string, rootRpid?: number, pictures?: UploadImageResult[]): Promise<BiliApiResponse<ReplyAddResult>> {
    return this.commentArea().add(message, rootRpid ?? parentRpid, parentRpid, pictures);
  }
  async likeComment(rpid: number, unlike = false) { return this.commentArea().like(rpid, unlike); }
  async hateComment(rpid: number, unhate = false) { return this.commentArea().hate(rpid, unhate); }
  async deleteComment(rpid: number) { return this.commentArea().delete(rpid); }
  async topComment(rpid: number, untop = false) { return this.commentArea().top(rpid, untop); }
  async reportComment(rpid: number, reason = ReplyReportReason.SPAM, content?: string) { return this.commentArea().report(rpid, reason, content); }
}

/** 用户卡片结果 */
export class UserResult implements UserCard {
  mid!: string; name!: string; approve!: boolean; sex!: string;
  rank!: string; face!: string; face_nft!: number; face_nft_type!: number;
  DisplayRank!: string; regtime!: number; spacesta!: number; birthday!: string;
  place!: string; description!: string; article!: number; attentions!: number[];
  fans!: number; friend!: number; attention!: number; sign!: string;
  level_info!: UserCard['level_info']; pendant!: UserCard['pendant'];
  nameplate!: UserCard['nameplate']; Official!: UserCard['Official'];
  official_verify!: UserCard['official_verify']; vip!: UserCard['vip'];
  is_senior_member!: number; name_render!: null;
  raw!: BiliApiResponse<{ card: UserCard }>;

  constructor(private client: BiliClient, raw: BiliApiResponse<{ card: UserCard }>) {
    Object.assign(this, raw.data?.card ?? {});
    this.raw = raw;
  }

  getUser(): UserResult { return this; }
}

/** 单条评论结果 */
export class CommentResult {
  rpid!: number; oid!: number; mid!: number; root!: number; parent!: number;
  count!: number; rcount!: number; likes!: number; ctime!: number;
  member!: ReplyEntry['member']; content!: ReplyEntry['content'];
  replies!: ReplyEntry['replies']; state!: number; up_action!: ReplyEntry['up_action'];

  constructor(
    private client: BiliClient,
    entry: ReplyEntry,
    private _oid: number,
  ) {
    Object.assign(this, entry);
    this.likes = (entry as any).like ?? 0;
  }

  /** 该评论所属评论区 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this._oid, 1);
  }

  private get _c(): CommentArea { return this.commentArea(); }

  async reply(message: string, pictures?: UploadImageResult[]): Promise<BiliApiResponse<ReplyAddResult>> {
    const root = this.root === 0 ? this.rpid : this.root;
    return this._c.add(message, root, this.rpid, pictures);
  }
  async like(unlike = false) { return this._c.like(this.rpid, unlike); }
  async hate(unhate = false) { return this._c.hate(this.rpid, unhate); }
  async delete() { return this._c.delete(this.rpid); }
  async top(untop = false) { return this._c.top(this.rpid, untop); }
  async report(reason = ReplyReportReason.SPAM, content?: string) { return this._c.report(this.rpid, reason, content); }
}
