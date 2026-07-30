import { BaseEntity } from './BaseEntity.js';
import type { BiliApiResponse } from '../core/types.js';
import type { ReplyNotification, AtNotification } from '../api/message.js';
import { ReplyReportReason } from '../api/comment.js';
import { CommentArea } from './CommentArea.js';
import type { ReplyAddResult } from '../api/comment.js';

/** "回复我的" 通知项 */
export class ReplyNotifyItem extends BaseEntity<ReplyNotification> {
  get id(): number { return this.rawData.id; }
  get authorName(): string { return this.rawData.user.nickname; }
  get authorMid(): number { return this.rawData.user.mid; }
  get authorAvatar(): string { return this.rawData.user.avatar; }
  get title(): string { return this.rawData.item.title; }
  get content(): string { return this.rawData.item.source_content; }
  get businessId(): number { return this.rawData.item.business_id; }
  get business(): string { return this.rawData.item.business; }
  get subjectId(): number { return this.rawData.item.subject_id; }
  get rootId(): number { return this.rawData.item.root_id; }
  get sourceId(): number { return this.rawData.item.source_id; }
  get uri(): string { return this.rawData.item.uri; }
  get replyTime(): number { return this.rawData.reply_time; }

  /** 评论区对象 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.subjectId, this.businessId);
  }

  private get _area(): CommentArea { return this.commentArea(); }
  private get _rootRpid(): number {
    return this.rootId === 0 ? this.sourceId : this.rootId;
  }

  /** 回复这条通知对应的评论 */
  async reply(message: string): Promise<BiliApiResponse<ReplyAddResult>> {
    return this._area.add(message, this._rootRpid, this.sourceId);
  }

  /** 点赞 / 取消 */
  async like(unlike = false): Promise<BiliApiResponse<null>> {
    return this._area.like(this.sourceId, unlike);
  }

  /** 点踩 / 取消 */
  async hate(unhate = false): Promise<BiliApiResponse<null>> {
    return this._area.hate(this.sourceId, unhate);
  }

  /** 删除 */
  async delete(): Promise<BiliApiResponse<null>> {
    return this._area.delete(this.sourceId);
  }

  /** 置顶 / 取消 */
  async top(untop = false): Promise<BiliApiResponse<null>> {
    return this._area.top(this.sourceId, untop);
  }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string): Promise<BiliApiResponse<null>> {
    return this._area.report(this.sourceId, reason, content);
  }
}

/** "@我的" 通知项 */
export class AtNotifyItem extends BaseEntity<AtNotification> {
  get id(): number { return this.rawData.id; }
  get authorName(): string { return this.rawData.user.nickname; }
  get authorMid(): number { return this.rawData.user.mid; }
  get authorAvatar(): string { return this.rawData.user.avatar; }
  get content(): string { return this.rawData.item.source_content; }
  get businessId(): number { return this.rawData.item.business_id; }
  get business(): string { return this.rawData.item.business; }
  get subjectId(): number { return this.rawData.item.subject_id; }
  get rootId(): number { return this.rawData.item.root_id; }
  get sourceId(): number { return this.rawData.item.source_id; }
  get uri(): string { return this.rawData.item.uri; }
  get atTime(): number { return this.rawData.at_time; }

  /** 评论区对象 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.subjectId, this.businessId);
  }

  private get _area(): CommentArea { return this.commentArea(); }
  private get _rootRpid(): number {
    return this.rootId === 0 ? this.sourceId : this.rootId;
  }

  /** 回复这条 @ 通知对应的评论 */
  async reply(message: string): Promise<BiliApiResponse<ReplyAddResult>> {
    return this._area.add(message, this._rootRpid, this.sourceId);
  }

  /** 点赞 / 取消 */
  async like(unlike = false): Promise<BiliApiResponse<null>> {
    return this._area.like(this.sourceId, unlike);
  }

  /** 点踩 / 取消 */
  async hate(unhate = false): Promise<BiliApiResponse<null>> {
    return this._area.hate(this.sourceId, unhate);
  }

  /** 删除 */
  async delete(): Promise<BiliApiResponse<null>> {
    return this._area.delete(this.sourceId);
  }

  /** 置顶 / 取消 */
  async top(untop = false): Promise<BiliApiResponse<null>> {
    return this._area.top(this.sourceId, untop);
  }

  /** 举报 */
  async report(reason = ReplyReportReason.SPAM, content?: string): Promise<BiliApiResponse<null>> {
    return this._area.report(this.sourceId, reason, content);
  }

  /** @详情列表 */
  atDetails(): { mid: number; nickname: string }[] {
    return (this.rawData.item.at_details ?? []).map(a => ({ mid: a.mid, nickname: a.nickname }));
  }
}