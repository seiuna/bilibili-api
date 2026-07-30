import { BaseEntity } from './BaseEntity.js';
import type { OpusDetail } from '../api/opus.js';
import { CommentArea } from './CommentArea.js';

export class Opus extends BaseEntity<OpusDetail['item']> {
  get id(): string { return this.rawData.id_str; }
  get type(): string { return this.rawData.type; }
  get visible(): boolean { return this.rawData.visible; }

  get basic(): OpusDetail['item']['basic'] { return this.rawData.basic; }
  get modules(): unknown[] { return this.rawData.modules; }

  get title(): string | undefined { return this.basic.title; }
  get uid(): number { return this.basic.uid; }
  get commentId(): string { return this.basic.comment_id_str; }
  get commentType(): number { return this.basic.comment_type; }
  get rid(): string { return this.basic.rid_str; }

  /** 获取该图文的评论区 */
  commentArea(): CommentArea {
    return new CommentArea(this.client, Number(this.rid), this.commentType);
  }
}