import { BaseEntity } from './BaseEntity.js';
import type { HistoryData } from '../api/history.js';
import { HistoryItemEntity } from './HistoryItemEntity.js';

/**
 * 观看历史分页实体
 *
 * 原始数据类型见 {@link HistoryData}。
 */
export class HistoryDataEntity extends BaseEntity<HistoryData> {
  get cursor(): HistoryData['cursor'] { return this.rawData.cursor; }
  get tab(): HistoryData['tab'] { return this.rawData.tab; }

  get list(): HistoryItemEntity[] {
    return this.rawData.list.map((item) => new HistoryItemEntity(this.client, item));
  }
}
