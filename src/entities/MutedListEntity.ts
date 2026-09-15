import { BaseEntity } from './BaseEntity.js';
import type { MutedUserItem } from '../api/live.js';
import { MutedUserEntity } from './MutedUserEntity.js';

/**
 * 直播间禁言名单分页数据
 *
 * 实体包装见 {@link MutedListEntity}。
 */
export interface MutedListData {
  data: MutedUserItem[];
  total: number;
  total_page: number;
}

/**
 * 直播间禁言名单实体
 *
 * 原始数据类型见 {@link MutedListData}。
 */
export class MutedListEntity extends BaseEntity<MutedListData> {
  get total(): number { return this.rawData.total; }
  get totalPage(): number { return this.rawData.total_page; }

  get data(): MutedUserEntity[] {
    return this.rawData.data.map((item) => new MutedUserEntity(this.client, item));
  }
}
