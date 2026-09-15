import { BaseEntity } from './BaseEntity.js';
import type { HistoryItem } from '../api/history.js';

/**
 * 观看历史条目实体
 *
 * 原始数据类型见 {@link HistoryItem}。
 */
export class HistoryItemEntity extends BaseEntity<HistoryItem> {
  get title(): string { return this.rawData.title; }
  get cover(): string { return this.rawData.cover; }
  get uri(): string { return this.rawData.uri; }
  get videos(): number { return this.rawData.videos; }
  get authorName(): string { return this.rawData.author_name; }
  get authorFace(): string { return this.rawData.author_face; }
  get authorMid(): number { return this.rawData.author_mid; }
  get viewAt(): number { return this.rawData.view_at; }
  get progress(): number { return this.rawData.progress; }
  get badge(): string { return this.rawData.badge; }
  get showTitle(): string { return this.rawData.show_title; }
  get duration(): number { return this.rawData.duration; }
  get kid(): number { return this.rawData.kid; }
  get tagName(): string { return this.rawData.tag_name; }
  get liveStatus(): number { return this.rawData.live_status; }
  get isFav(): boolean { return this.rawData.is_fav; }

  get history(): HistoryItem['history'] { return this.rawData.history; }
}
