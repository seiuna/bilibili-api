import type { BiliClient } from '../client.js';
import type { BiliApiResponse } from '../types.js';
import type { ReplyNotification, AtNotification, ReplyAddResult } from './types.js';
import { ReplyReportReason } from './types.js';
import { CommentArea } from './comment-area.js';


export class ReplyFeedItem {
  constructor(
    private client: BiliClient,
    private raw: ReplyNotification,
  ) {}

  /**
   * 评论区对象 — 使用 subject_id + business_id
   * @returns {@link CommentArea}
   */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.raw.item.subject_id, this.raw.item.business_id);
  }

  private get _area(): CommentArea { return this.commentArea(); }
  private get _rootRpid(): number {
    return this.raw.item.root_id === 0 ? this.raw.item.source_id : this.raw.item.root_id;
  }

  /**
   * 回复这条通知对应的评论（不支持图片）
   */
  async reply(message: string): Promise<BiliApiResponse<ReplyAddResult>> {
    return this._area.add(message, this._rootRpid, this.raw.item.source_id);
  }

  /** 点赞 / 取消 */
  async like(unlike = false): Promise<BiliApiResponse<null>> {
    return this._area.like(this.raw.item.source_id, unlike);
  }

  /** 点踩 / 取消 */
  async hate(unhate = false): Promise<BiliApiResponse<null>> {
    return this._area.hate(this.raw.item.source_id, unhate);
  }

  /** 删除 */
  async delete(): Promise<BiliApiResponse<null>> {
    return this._area.delete(this.raw.item.source_id);
  }

  /** 置顶 / 取消 */
  async top(untop = false): Promise<BiliApiResponse<null>> {
    return this._area.top(this.raw.item.source_id, untop);
  }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string): Promise<BiliApiResponse<null>> {
    return this._area.report(this.raw.item.source_id, reason, content);
  }

  // ---- getter ----
  id(): number { return this.raw.id; }
  authorName(): string { return this.raw.user.nickname; }
  authorMid(): number { return this.raw.user.mid; }
  authorAvatar(): string { return this.raw.user.avatar; }
  title(): string { return this.raw.item.title; }
  content(): string { return this.raw.item.source_content; }
  businessId(): number { return this.raw.item.business_id; }
  business(): string { return this.raw.item.business; }
  subjectId(): number { return this.raw.item.subject_id; }
  rootId(): number { return this.raw.item.root_id; }
  sourceId(): number { return this.raw.item.source_id; }
  uri(): string { return this.raw.item.uri; }
  replyTime(): number { return this.raw.reply_time; }
}

export class AtFeedItem {
  constructor(
    private client: BiliClient,
    private raw: AtNotification,
  ) {}

  /**
   * 评论区对象 — 使用 subject_id + business_id
   * @returns {@link CommentArea}
   */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.raw.item.subject_id, this.raw.item.business_id);
  }

  private get _area(): CommentArea { return this.commentArea(); }
  private get _rootRpid(): number {
    return this.raw.item.root_id === 0 ? this.raw.item.source_id : this.raw.item.root_id;
  }

  /**
   * 回复这条 @ 通知对应的评论（不支持图片）
   */
  async reply(message: string): Promise<BiliApiResponse<ReplyAddResult>> {
    return this._area.add(message, this._rootRpid, this.raw.item.source_id);
  }

  /** 点赞 / 取消 */
  async like(unlike = false): Promise<BiliApiResponse<null>> {
    return this._area.like(this.raw.item.source_id, unlike);
  }

  /** 点踩 / 取消 */
  async hate(unhate = false): Promise<BiliApiResponse<null>> {
    return this._area.hate(this.raw.item.source_id, unhate);
  }

  /** 删除 */
  async delete(): Promise<BiliApiResponse<null>> {
    return this._area.delete(this.raw.item.source_id);
  }

  /** 置顶 / 取消 */
  async top(untop = false): Promise<BiliApiResponse<null>> {
    return this._area.top(this.raw.item.source_id, untop);
  }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string): Promise<BiliApiResponse<null>> {
    return this._area.report(this.raw.item.source_id, reason, content);
  }

  // ---- getter ----
  id(): number { return this.raw.id; }
  authorName(): string { return this.raw.user.nickname; }
  authorMid(): number { return this.raw.user.mid; }
  authorAvatar(): string { return this.raw.user.avatar; }
  content(): string { return this.raw.item.source_content; }
  businessId(): number { return this.raw.item.business_id; }
  business(): string { return this.raw.item.business; }
  subjectId(): number { return this.raw.item.subject_id; }
  rootId(): number { return this.raw.item.root_id; }
  sourceId(): number { return this.raw.item.source_id; }
  uri(): string { return this.raw.item.uri; }
  atTime(): number { return this.raw.at_time; }
  atDetails(): { mid: number; nickname: string }[] {
    return (this.raw.item.at_details ?? []).map(a => ({ mid: a.mid, nickname: a.nickname }));
  }
}
