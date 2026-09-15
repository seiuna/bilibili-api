import { BaseEntity } from './BaseEntity.js';
import type { ReplyFeedData } from '../api/message.js';
import { ReplyNotifyItem } from './NotifyItem.js';

/**
 * "回复我的" 通知分页实体
 *
 * 原始数据类型见 {@link ReplyFeedData}。
 */
export class ReplyFeedEntity extends BaseEntity<ReplyFeedData> {
  /** 游标信息 */
  get cursor(): ReplyFeedData['cursor'] { return this.rawData.cursor; }

  /** 是否已到末页 */
  get isEnd(): boolean { return this.rawData.cursor?.is_end ?? true; }

  /** 上次查看时间 */
  get lastViewAt(): number { return this.rawData.last_view_at; }

  /** 通知条目（已包装为实体） */
  get items(): ReplyNotifyItem[] {
    return (this.rawData.items ?? []).map((item) => new ReplyNotifyItem(this.client, item));
  }
}
