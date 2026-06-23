import type { BiliClient } from '../client.js';
import type { ReplyNotification, AtNotification } from './types.js';
import { CommentArea } from './comment-area.js';

export class ReplyFeedItem {
  constructor(
    private client: BiliClient,
    private raw: ReplyNotification,
  ) {}

  /** 评论区对象 — 使用 subject_id + business_id */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.raw.item.subject_id, this.raw.item.business_id);
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

  /** 评论区对象 — 使用 subject_id + business_id */
  commentArea(): CommentArea {
    return new CommentArea(this.client, this.raw.item.subject_id, this.raw.item.business_id);
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
  sourceId(): number { return this.raw.item.source_id; }
  uri(): string { return this.raw.item.uri; }
  atTime(): number { return this.raw.at_time; }
  atDetails(): { mid: number; nickname: string }[] {
    return (this.raw.item.at_details ?? []).map(a => ({ mid: a.mid, nickname: a.nickname }));
  }
}
