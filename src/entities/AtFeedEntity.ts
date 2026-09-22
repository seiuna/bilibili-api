import { BaseEntity } from './BaseEntity.js';
import type { AtFeedData } from '../api/message.js';
import { AtNotifyItem } from './NotifyItem.js';

/**
 * "@我的" 通知分页实体
 *
 * 原始数据类型见 {@link AtFeedData}。
 */
export class AtFeedEntity extends BaseEntity<AtFeedData> {
  /** 游标信息 */
  get cursor(): AtFeedData['cursor'] { return this.rawData.cursor; }

  /** 是否已到末页 */
  get isEnd(): boolean { return this.rawData.cursor?.is_end ?? true; }

  /** 通知条目（已包装为实体） */
  get items(): AtNotifyItem[] {
    return (this.rawData.items ?? []).map((item) => new AtNotifyItem(this.client, item));
  }
}
