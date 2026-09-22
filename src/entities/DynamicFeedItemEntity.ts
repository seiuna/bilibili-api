import { BaseEntity } from './BaseEntity.js';
import type { DynamicFeedItem } from '../api/dynamic.js';

/**
 * 动态信息流条目实体
 *
 * 原始数据类型见 {@link DynamicFeedItem}。
 */
export class DynamicFeedItemEntity extends BaseEntity<DynamicFeedItem> {
  get idStr(): string { return this.rawData.id_str; }
  get basic(): DynamicFeedItem['basic'] { return this.rawData.basic; }
  get modules(): DynamicFeedItem['modules'] { return this.rawData.modules; }
}
