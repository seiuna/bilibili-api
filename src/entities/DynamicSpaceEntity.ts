import { BaseEntity } from './BaseEntity.js';
import type { DynamicSpaceData } from '../api/dynamic.js';
import { DynamicFeedItemEntity } from './DynamicFeedItemEntity.js';

/**
 * 用户空间动态列表实体
 *
 * 原始数据类型见 {@link DynamicSpaceData}。
 */
export class DynamicSpaceEntity extends BaseEntity<DynamicSpaceData> {
  get hasMore(): boolean { return this.rawData.has_more; }
  get offset(): string | undefined { return this.rawData.offset; }

  get items(): DynamicFeedItemEntity[] {
    return this.rawData.items.map((item) => new DynamicFeedItemEntity(this.client, item));
  }
}
